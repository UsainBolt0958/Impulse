# Whole-Paper PYQ Import Format

The Admin Portal has separate whole-paper import flows for JEE Main, NEET, and MHT CET. Each imports one paper/session into the PYQ question library from JSON plus optional companion image files; these are not the single-chapter PYQ import format.

The paper-level metadata supplies one exam, year, and shift or paper identifier shared by every question. Each question supplies its own subject and chapter. No shift filter is added; the shift is shown only while solving an imported PYQ.

## Upload steps

1. Prepare one UTF-8 JSON file for exactly one exam paper or shift.
2. Select that JSON file in the importer.
3. Select the referenced image assets as companion files. SVG, PNG, JPG/JPEG, and WEBP images are supported.
4. Validate the paper, review the question preview and subject counts, then import.

Image references are matched to uploaded assets by filename, case-insensitively. Keep filenames unique within a paper. Image URLs are not accepted; include referenced local files in the companion image selection.

## Shared JSON schema

```json
{
  "schemaVersion": 1,
  "exam": "JEE MAINS",
  "year": 2025,
  "shiftName": "22 January 2025 - Shift 1",
  "expectedQuestionCount": 2,
  "questions": [
    {
      "id": "JEE-MAINS-2025-01-22-S1-PHY-001",
      "subject": "Physics",
      "chapter": "Electrostatics",
      "difficulty": "Medium",
      "type": "MCQ",
      "text": "Question text. Markdown and inline math are supported.",
      "image": "PHY-001-Q.svg",
      "options": {
        "A": { "text": "Option A", "image": "PHY-001-OPT-A.svg" },
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "answer": "A",
      "solution": "Explanation for the correct answer."
    },
    {
      "id": "JEE-MAINS-2025-01-22-S1-MATH-001",
      "subject": "Mathematics",
      "chapter": "Circle",
      "difficulty": "Hard",
      "type": "NUM",
      "text": "Enter the value of the expression.",
      "answer": 0,
      "solution": "The expression evaluates to zero."
    }
  ]
}
```

## Field rules

- `schemaVersion` must be `1`; `exam` must match the selected importer: `JEE MAINS`, `NEET`, or `MHTCET` (the spelling `MHT CET` is also accepted).
- `year` must be an integer from 2002 through the current calendar year.
- `shiftName` must be a non-empty descriptive string. It applies to every question; do not put a year or shift override on individual questions.
- `expectedQuestionCount` must equal the number of questions, with a supported count of 1–300.
- Every question must have a unique stable `id`, a non-empty `chapter`, and `difficulty` exactly `Easy`, `Medium`, or `Hard`. JEE Main subjects are `Physics`, `Chemistry`, `Mathematics`; NEET subjects are `Physics`, `Chemistry`, `Biology`; MHT CET subjects are `Physics`, `Chemistry`, `Mathematics`, `Biology`. NEET `Botany` and `Zoology` values are accepted and stored under `Biology`; put the specific topic/chapter in `chapter`.
- `type` is `MCQ` or `NUM`.
- `text` is required. `image` is optional and names the question image.
- For `MCQ`, provide options `A` through `D` and set `answer` to one of those labels. Each option may be a string or an object with `text` and/or `image`.
- For `NUM`, set `answer` to the numeric answer. Numeric zero is valid. The imported answer is stored as text for PYQ solving.
- `solution` is optional text. The importer warns when it is absent; solution image fields are not part of this format.
- `image` and option `image` values refer to companion filenames, not paths. Referenced images must be uploaded and use a supported extension. Missing assets and duplicate uploaded filenames are validation errors; unused uploads are reported as warnings.
- Importing an ID already present for the same exam, year, and shift/paper identifier is rejected to prevent duplicate imports. Use stable IDs across revisions of the same source paper.

## Exam-specific notes

- **JEE Main:** Use one JSON per shift. The paper-level `shiftName` should identify the date and shift (for example, `22 January 2025 - Shift 1`). MCQ and numeric (`NUM`) questions are supported.
- **NEET:** Use one JSON for the exam session, and set `shiftName` to a descriptive session/paper identifier (for example, `NEET UG 2025`). Use Physics, Chemistry, and Biology. Botany/Zoology can be used as a subject alias but is stored as Biology; keep its topic in the chapter field.
- **MHT CET:** Use one JSON per paper/shift, with `shiftName` describing its date, session, or paper group (for example, `2 May 2025 - Shift 1 - PCM`). Use Physics and Chemistry plus the relevant Mathematics or Biology subject. Both PCM and PCB subject combinations are supported. MCQ and numeric questions use the shared schema.

The importer validates that every question subject is allowed for the selected exam. It does not currently use a per-question marking scheme; PYQ practice checks the imported correct answer and solution.

In the Admin Portal, **Imported papers** lists whole-paper JSON imports and can remove a complete exam/year/shift group. The action deletes its imported question records together. Since PYQ chapter lists are derived from available questions, chapters used only by the removed paper disappear automatically; any chapter still used by another question remains. Older whole-paper imports are also listed using their import activity records.

## Recommended image naming

Use IDs or subject/question numbers to make references unambiguous, for example:

- `PHY-001-Q.svg` — Physics question image
- `PHY-001-OPT-A.svg` — option A image
- `BIO-001-Q.svg` — Biology question image

Keep the JSON `id` stable and ensure every filename referenced by `image` or an option's `image` exactly matches one uploaded file (ignoring case). Avoid using the same filename for different assets.
