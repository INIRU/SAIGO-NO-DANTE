# PaddleOCR models for capture OCR

Official PaddlePaddle exports, license Apache-2.0 (model cards; full text in LICENSE from PaddlePaddle/PaddleOCR).

| File | Source | Revision | sha256 |
|---|---|---|---|
| det.onnx | https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx (inference.onnx) | e6f4fa85f00e168c862bc462aebca69eef9b3d3d | a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d |
| rec.onnx | https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx (inference.onnx) | 5c6f574b8e2230adf4287b33e736d71b9fabd28e | 92f0b7785e64fc9090106a241cf4c1eb97472824558272751b88a2a4476d3a08 |
| dict.json | https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx (inference.yml PostProcess.character_dict) | 5c6f574b8e2230adf4287b33e736d71b9fabd28e | 34108ff074b9461c178e26081832ab4403f2d1b6fc2057537b69310e64cb65a1 |
| en/rec.onnx | https://huggingface.co/PaddlePaddle/en_PP-OCRv5_mobile_rec_onnx (inference.onnx) | 3fafbc3b5dcf93dd72add9f48368be8a3a2cd33b | b5f833dfc5d0eb71da397b4efa06ebeee9b431b690a47d6af40d77d8eabc557f |
| en/dict.json | https://huggingface.co/PaddlePaddle/en_PP-OCRv5_mobile_rec_onnx (inference.yml PostProcess.character_dict) | 3fafbc3b5dcf93dd72add9f48368be8a3a2cd33b | a981c85a58da77df3ac590a516a489a9e77bdb0d10428f8c008295b8b6f40f28 |
| ja/rec.onnx | https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx (inference.onnx) | b8f84f0b80c529de40b4fbb3544b84fa7233a513 | 5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634 |
| ja/dict.json | https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx (inference.yml PostProcess.character_dict) | b8f84f0b80c529de40b4fbb3544b84fa7233a513 | 46f800890c516f8a4e9e9d690f1ef9dc8d36782333463363d80307d572acb8be |

The recognizer follows the game language chosen in Assist: Korean uses rec.onnx, English en/, Japanese ja/; det.onnx is
shared. PP-OCRv6 has no Hangul in its dictionary, so Korean stays on the Korean v5 model. On Japanese gameplay frames
PP-OCRv6_small kept the long-vowel mark ー that the multilingual v5 mobile model dropped.

Pre/post-processing follows PaddleX (DetResizeForTest, NormalizeImage, DBPostProcess, OCRReisizeNormImg, CTCLabelDecode):
see lib/vision/paddle-text.ts. The models are used unmodified; no fine-tuning or conversion.
