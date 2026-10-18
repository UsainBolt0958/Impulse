# PYQ JSON import format

In Admin Portal, open **Questions → Import PYQs**. Choose the target exam, subject, chapter, and the exact number of questions to add. Then select the JSON manifest and all referenced image files. The importer validates the full batch before uploading images or saving questions.

## Manifest

```json
{
  "schemaVersion": 1,
  "expectedQuestionCount": 1,
  "questions": [
    {
      "id": "JEE-P-2024-001",
      "year": 2024,
      "shift": "Shift 1",
      "difficulty": "Hard",
      "type": "MCQ",
      "text": "Question statement with inline $math$",
      "image": "JEE-P-2024-001-Q.svg",
      "options": {
        "A": { "text": "First option", "image": "JEE-P-2024-001-OPT-A.svg" },
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      },
      "answer": "A",
      "solution": "Worked solution"
    }
  ]
}
```

## Rules

- `schemaVersion` must be `1`.
- `expectedQuestionCount`, the admin-selected count, and the length of `questions` must all match. The importer accepts 1–200 questions per batch.
- Exam, subject, and chapter are selected in the admin dialog and applied consistently to every imported question.
- Each question needs an integer `year` of 1900 or later and a non-empty `shift` (for example `Shift 2`, `28s1`, or `Paper 1`). The year is saved as numeric question metadata and is available in PYQ year filters.
- `id` is optional. If present, it must be unique in the JSON and not already used for the selected exam/subject/chapter.
- `difficulty` is required for every question and must be `Easy`, `Medium`, or `Hard` (case-insensitive). It is saved as PYQ question metadata and works with the practice difficulty filter.
- `type` is `MCQ` or `NUM`. `NUMERIC` is also accepted and stored as `NUM`.
- A question needs non-empty `text`, an `image`, or both. `image` is the exact filename of an uploaded asset.
- MCQ `options` must contain exactly `A`, `B`, `C`, and `D`. Each option can be a string or an object containing `text`, `image`, or both. Every option needs text or an image.
- MCQ `answer` must be `A`, `B`, `C`, or `D`. Numeric `answer` must be a finite JSON number or numeric string; zero is valid.
- `solution` is optional; the importer warns when it is missing. If provided, it must be a string.
- Images can be SVG, PNG, JPG/JPEG, or WEBP, with a 5 MB maximum per file. Filenames are matched case-insensitively; do not include paths in JSON image values. Unsafe SVGs are rejected by the upload server.
- Only referenced images are uploaded. Unreferenced selected images are reported as warnings.

For numeric questions, omit `options` and `image` if they are not needed:

```json
{
  "year": 2024,
  "shift": "Paper 2",
  "difficulty": "Medium",
  "type": "NUM",
  "text": "Enter the value of the answer.",
  "answer": 0,
  "solution": "The answer is zero."
}
```
