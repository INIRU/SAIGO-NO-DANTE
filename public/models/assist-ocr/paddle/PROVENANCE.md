# PaddleOCR models for capture OCR

Official PaddlePaddle exports, license Apache-2.0 (model cards; full text in LICENSE from PaddlePaddle/PaddleOCR).

| File | Source | Revision | sha256 |
|---|---|---|---|
| det.onnx | https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx (inference.onnx) | e6f4fa85f00e168c862bc462aebca69eef9b3d3d | a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d |
| rec.onnx | https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx (inference.onnx) | 5c6f574b8e2230adf4287b33e736d71b9fabd28e | 92f0b7785e64fc9090106a241cf4c1eb97472824558272751b88a2a4476d3a08 |
| dict.json | https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx (inference.yml PostProcess.character_dict) | 5c6f574b8e2230adf4287b33e736d71b9fabd28e | 34108ff074b9461c178e26081832ab4403f2d1b6fc2057537b69310e64cb65a1 |

Pre/post-processing follows PaddleX (DetResizeForTest, NormalizeImage, DBPostProcess, OCRReisizeNormImg, CTCLabelDecode):
see lib/vision/paddle-text.ts. The models are used unmodified; no fine-tuning or conversion.
