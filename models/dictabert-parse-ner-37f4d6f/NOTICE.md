# The named-entity model in this folder

**Source:** [DictaBERT-parse](https://huggingface.co/dicta-il/dictabert-parse) by
[Dicta](https://dicta.org.il) (`dicta-il/dictabert-parse`, revision
`37f4d6fd556766f15e955fe5bd0f16942b46853e`), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**Changes made here:**
- Only the named-entity head was kept, loaded into a standard `BertForTokenClassification`.
- It was exported to ONNX (opset 14).
- The weights were quantised to 8 bits, per channel.
- The weights file is split into four parts so the repository can hold it. The page joins them
  and checks the joined file against its SHA-256 before use.
- The tokenizer and configuration files are Dicta's, unchanged. The page corrects one pattern of
  the tokenizer when it loads it: it writes `\w` as the Unicode classes that the Rust tokenizers
  library means by it.

**How the export was made and checked:**
- The recipe: `torch.onnx.export` (the TorchScript exporter), then ONNX Runtime dynamic
  quantisation (`per_channel=True`, `reduce_range=True`, weights int8), the same as the q8 file
  transformers.js publishes for DictaBERT-NER. The same recipe applied to DictaBERT-NER agrees with
  that published file on 99.8% of token labels.
- The ONNX logits agree with PyTorch to within 1.2e-5.
- The page's SHA-256 check expects `71e519f3151eb78b73bfcaf02538cbdca1f69593235186b7b246b208c62e70ca`
  (184,983,343 bytes).

**Citation** (as the model card asks):

> Shaltiel Shmidman, Avi Shmidman, Moshe Koppel, Reut Tsarfaty. *MRL Parsing Without Tears: The
> Case of Hebrew.* 2024. arXiv:2403.06970.

The model is used here as a file that runs in the user's browser. No text is sent anywhere.
