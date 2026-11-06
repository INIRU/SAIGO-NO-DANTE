"""Shared by the Assist's training and evaluation scripts (scripts/vision): the input the browser gives the models
(features/assist/lib/preprocess.ts for the scene model, features/assist/lib/icon-classifier.ts for the icon model), the app's strong-read
bar, the vestige class, a stable split, the model builders and the ONNX export with its parity check.

tests/features/assist/lib/assist-model-constants.test.ts fails if these constants and the browser's drift apart;
the dataset pipeline (pipeline/assist/_common.py, outside this repository) mirrors them for its dataset and evaluation scripts.
"""
import hashlib

import numpy as np

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], np.float32)
SCENE_SIZE = 224
ICON_SIZE = 96
ICON_CROP = 1.3          # icon crops are 1.3x the app's slot region
LOGIT_SCALE = 1.5        # icon logits are scaled by this before the softmax (ICON_LOGIT_SCALE)
STRONG_P = 0.85          # a strong read: top probability at least this ...
STRONG_LEAD = 0.25       # ... and at least this far ahead of the runner-up (STRONG_READ)
VESTIGES = frozenset({'9991', '9992', '9993', '9994', '9995'})
MNV4S = 'mobilenetv4_conv_small.e2400_r224_in1k'


def group(gift_id):
    """The five vestiges are one class: the app never tells them apart."""
    return '9991' if str(gift_id) in VESTIGES else str(gift_id)


def softmax(logits, axis=-1):
    logits = np.asarray(logits, np.float64)
    e = np.exp(logits - logits.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)


def strong(probabilities):
    """Rows the app reads with certainty: the top probability over STRONG_P and STRONG_LEAD ahead of the second."""
    top = np.sort(np.asarray(probabilities), axis=-1)
    return (top[..., -1] >= STRONG_P) & (top[..., -1] - top[..., -2] >= STRONG_LEAD)


def stable_split(key, test_every=5, validation_every=0):
    """'test', 'validation' or 'train' from a hash of `key` (a run, a recording window): adding groups never moves another."""
    bucket = int(hashlib.md5(str(key).encode()).hexdigest(), 16)
    if bucket % test_every == 0:
        return 'test'
    if validation_every and (bucket // test_every) % validation_every == 0:
        return 'validation'
    return 'train'


def to_input(image, size):
    """An RGB PIL image as the network input the browser builds: RGB / 255, ImageNet mean and std, CHW float32."""
    array = np.asarray(image.convert('RGB'), np.float32)
    if array.shape[:2] != (size, size):
        raise ValueError(f'expected a {size}x{size} image, got {array.shape[1]}x{array.shape[0]}')
    return ((array / 255 - IMAGENET_MEAN) / IMAGENET_STD).transpose(2, 0, 1).copy()


def mnv4s(classes, pretrained=True):
    """timm MobileNetV4-Conv-Small (ImageNet, e2400 r224) with a `classes`-way head; every layer trains."""
    import timm
    return timm.create_model(MNV4S, pretrained=pretrained, num_classes=classes)


def from_onnx(path, classes):
    """A torchvision MobileNetV3-small holding the weights of a model these scripts exported. The export folded every batch
    norm into its convolution, so the batch norms become identities and the convolutions take the folded weights."""
    import onnx
    import onnxruntime as ort
    import torch
    from onnx import numpy_helper
    from torch import nn
    from torchvision import models
    graph = onnx.load(str(path)).graph
    stored = {item.name: numpy_helper.to_array(item) for item in graph.initializer}
    weights = {kind: [[stored[name] for name in node.input[1:]] for node in graph.node if node.op_type == kind] for kind in ('Conv', 'Gemm')}
    model = models.mobilenet_v3_small()
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, classes)
    for module in list(model.modules()):
        for name, child in list(module.named_children()):
            if isinstance(child, nn.BatchNorm2d):
                setattr(module, name, nn.Identity())
    for kind, layers in (('Conv', [m for m in model.modules() if isinstance(m, nn.Conv2d)]), ('Gemm', [m for m in model.modules() if isinstance(m, nn.Linear)])):
        if len(layers) != len(weights[kind]):
            raise ValueError(f'{path}: {len(weights[kind])} {kind} nodes for {len(layers)} layers')
        for layer, values in zip(layers, weights[kind]):
            if tuple(layer.weight.shape) != values[0].shape:
                raise ValueError(f'{path}: {kind} weight {values[0].shape} for a layer of {tuple(layer.weight.shape)}')
            layer.weight = nn.Parameter(torch.from_numpy(values[0].copy()))
            layer.bias = nn.Parameter(torch.from_numpy(values[1].copy())) if len(values) > 1 else None
    model.eval()
    side = graph.input[0].type.tensor_type.shape.dim[2].dim_value or SCENE_SIZE
    sample = torch.randn(1, 3, side, side)
    expected = ort.InferenceSession(str(path), providers=['CPUExecutionProvider']).run(None, {graph.input[0].name: sample.numpy()})[0]
    with torch.inference_mode():
        if not np.allclose(model(sample).numpy(), expected, atol=1e-3, rtol=1e-3):
            raise ValueError(f'{path}: the rebuilt model does not reproduce the ONNX outputs')
    return model


def export_onnx(model, sample, path, input_name, output_name='logits', tolerance=1e-4):
    """One ONNX file at opset 17 (the newer exporter splits the weights out and cannot go below 18), batch axis dynamic,
    checked against the PyTorch model on `sample`. Returns the largest absolute difference; raises when over `tolerance`."""
    import onnxruntime as ort
    import torch
    model = model.cpu().eval()
    torch.onnx.export(model, sample, str(path), input_names=[input_name], output_names=[output_name],
                      dynamic_axes={input_name: {0: 'batch'}, output_name: {0: 'batch'}}, opset_version=17, dynamo=False)
    with torch.inference_mode():
        expected = model(sample).numpy()
    actual = ort.InferenceSession(str(path), providers=['CPUExecutionProvider']).run(None, {input_name: sample.numpy()})[0]
    error = float(np.max(np.abs(expected - actual)))
    if not np.allclose(expected, actual, atol=tolerance, rtol=tolerance):
        raise RuntimeError(f'ONNX numerical parity failed for {path} (max abs error {error})')
    return error
