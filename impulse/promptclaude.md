# Prompt for Claude: prepare an Impulse Test Series import

You are preparing structured question data for the Impulse Test Series admin importer. Produce exactly one valid `manifest.json` and any referenced image files as separate assets. Do not create a PDF, ZIP, Markdown question file, or explanatory prose unless the user separately asks for those.

## Accuracy rules

- Transcribe the source material faithfully. Do not guess missing questions, options, answers, subject names, marking rules, or image matches.
- If a correct answer, question boundary, subject, section, or image association is unclear, stop and report the exact question ID and ambiguity instead of making up a value.
- Do not calculate or infer an answer from the question unless explicitly asked to solve it. When asked to solve, clearly distinguish a computed answer from a source-provided answer and ask for human verification if uncertain.
- Preserve equations and symbols. Use standard LaTeX delimiters in text, for example `$x^2$` or `$$\\frac{a}{b}$$`.
- Keep the original question order within each section. Do not reorder by ID, answer, or source page.
- Use JSON strings for question/option/solution text. Escape quotes, backslashes, and newlines correctly. JSON must parse as-is: no comments, trailing commas, Markdown fences, or `undefined` values.

## Output files

Provide:

1. `manifest.json`
2. Every image file referenced by the manifest, with its exact filename and case preserved.

Images are uploaded separately in the admin panel. Use standalone SVG files for vector diagrams whenever possible. Do not embed SVG markup, a data URI, or a path to a local computer in the JSON.

## Required JSON shape

```json
{
  "schemaVersion": 1,
  "test": {
    "title": "JEE Mock Test 01",
    "durationMinutes": 180,
    "expectedQuestionCount": 3
  },
  "subjects": [
    {
      "name": "Physics",
      "sections": [
        {
          "name": "PHY-A",
          "type": "MCQ",
          "expectedQuestionCount": 1,
          "marking": {
            "correct": 4,
            "wrong": -1,
            "unanswered": 0
          },
          "questions": [
            {
              "id": "PHY-A-001",
              "number": "1",
              "text": "A particle moves as shown. Find its speed.",
              "image": "PHY-A-001-Q.svg",
              "options": [
                { "key": "A", "text": "1 m/s" },
                { "key": "B", "text": "2 m/s" },
                { "key": "C", "text": "3 m/s" },
                { "key": "D", "text": "4 m/s" }
              ],
              "answer": "B",
              "solution": "Use $v = d/t$."
            }
          ]
        }
      ]
    },
    {
      "name": "Chemistry",
      "sections": [
        {
          "name": "CHEM-B",
          "type": "MULTI",
          "expectedQuestionCount": 1,
          "marking": {
            "correct": 4,
            "wrong": -2,
            "unanswered": 0
          },
          "questions": [
            {
              "id": "CHEM-B-001",
              "number": "1",
              "text": "Select all correct statements.",
              "options": [
                { "key": "A", "text": "Statement A" },
                { "key": "B", "text": "Statement B" },
                { "key": "C", "text": "Statement C" },
                { "key": "D", "text": "Statement D" }
              ],
              "answer": ["A", "C"],
              "solution": "Statements A and C are correct."
            }
          ]
        }
      ]
    },
    {
      "name": "Mathematics",
      "sections": [
        {
          "name": "MATH-N",
          "type": "NUM",
          "expectedQuestionCount": 1,
          "marking": {
            "correct": 4,
            "wrong": 0,
            "unanswered": 0
          },
          "questions": [
            {
              "id": "MATH-N-001",
              "number": "1",
              "text": "Calculate the value of $x$.",
              "answer": -2.5,
              "solution": "The calculation gives $x=-2.5$."
            }
          ]
        }
      ]
    }
  ]
}
```

The example is illustrative; replace it with the complete supplied test. The importer validates the manifest and shows a preview before saving.

## Field requirements and interpretation

### Test and subjects

- `schemaVersion` must be the number `1`.
- `test.title` is required and must be a non-empty string.
- `test.durationMinutes` is a positive whole number.
- `test.expectedQuestionCount` is the total number of question objects across all subjects and sections. It must exactly match the total below.
- `subjects` is a non-empty array. Each subject has a non-empty `name` and at least one section.
- Use one canonical spelling/capitalization for a subject throughout the test. Subject names are matched case-insensitively for duplicate detection; do not include both `Math`, `Maths`, and `Mathematics`.

### Sections and question counts

- Each section has a `name`, `type`, positive whole-number `expectedQuestionCount`, explicit `marking`, and a `questions` array.
- Section names must be unique across the **entire test**, not merely within one subject. Use names such as `PHY-A`, `CHEM-A`, and `MATH-A`; using `A` in all subjects can cause section-marking collisions in the exam engine.
- `expectedQuestionCount` must equal the number of question objects in that section. The overall test count must equal the sum of all section counts. Never pad with blank questions or omit an unparsed question to make counts fit.
- The source question numbering may restart under a new section. IDs must not restart or repeat.
- Preserve section order and question order from the source test.

### Question IDs and numbering

- `id` is required, unique across the whole test, and must use 1–100 letters/numbers/periods/underscores/hyphens, starting with a letter or number. Example: `PHY-A-001`.
- `number` is the original printed question number, represented as a string or number. Preserve subparts if needed, e.g. `"12(a)"`. It may restart in another section. It is not a substitute for the unique `id`.
- `text` must be a string. If the question is entirely a diagram, `image` can provide the visual question, but do not leave both `text` and `image` empty.
- Use plain text with Markdown/LaTeX for formulas. HTML is not required. Escape JSON correctly.

### Question types and answers

- `type` must be exactly `MCQ`, `MULTI`, or `NUM`. The section type applies to every question in that section.
- `MCQ`: exactly four options in the order `A`, `B`, `C`, `D`. Each option must have text, an image, or both. `answer` is exactly one string key, e.g. `"B"`.
- `MULTI`: exactly the same four ordered options. `answer` is a non-empty array of distinct keys, e.g. `["A", "C"]`. Do not encode it as `"AC"` in the JSON.
- The current exam UI displays four choices for choice questions. Do not provide E/F options in this format.
- `NUM`: omit `options` or use an empty array. `answer` is a finite number or numeric string, e.g. `-2.5`. Use a period for decimals and do not use thousands separators.
- An inclusive numeric range is represented as:

  ```json
  "answer": { "min": 1.25, "max": 1.5 }
  ```

  `min` and `max` must be finite numbers and `min` must not exceed `max`. Optionally add `"allowSign": true` only when either sign of a matching absolute value is accepted. Do not write an ambiguous string such as `"1-2"` for a range.
- Correct answers must come from the source answer key or a separately requested, verified solution. Never leave an answer blank or use a guessed placeholder.
- `solution` is the worked solution/explanation as a string. It is strongly recommended for every question; missing solutions are shown as import warnings. Preserve math in LaTeX.

### Marking rules

- Marking is specified per section and applies uniformly to that section's question type.
- `marking.correct` is the positive score for a fully correct answer and must be a finite positive number.
- `marking.wrong` is the signed score for a wrong attempted answer and must be zero or negative. Write `-1` for a one-mark penalty, not `1`.
- `marking.unanswered` must be `0`. Skipped questions are not penalized by this format.
- The importer translates signed `wrong` into the admin/exam engine's wrong-mark penalty magnitude. Example: `wrong: -2` is saved as a penalty of 2 and scored as minus 2.
- Current MULTI scoring behavior is: all correct choices and no wrong choices earns the section's `correct` marks; selecting a non-empty proper subset of correct choices earns one point per correctly selected option; selecting any incorrect option receives the section's wrong-answer penalty. This partial-credit rule is currently part of the exam engine, not configurable in JSON. Do not claim a different partial-credit scheme in the manifest.
- Do not use special answer placeholders such as `ALL`; provide a normal valid key or ask for review.

### Images and SVG requirements

- `image` on a question and `image` on an option are optional exact filenames of separately uploaded assets. For example:

  ```json
  {
    "key": "A",
    "text": "The diagram shows the circuit.",
    "image": "PHY-A-001-OPT-A.svg"
  }
  ```

- Reference each asset by filename only. Do not include directories, relative paths, URLs, or case variations. Every referenced image must be provided with the same filename; do not reference one filename for different image content.
- Supported image types are SVG, PNG, JPG/JPEG, and WEBP. Each image must be no larger than 5 MB.
- Prefer standalone SVG for line diagrams, plots, and geometric figures. Keep each SVG self-contained and static: no scripts, event-handler attributes, external links/resources, `<foreignObject>`, embedded HTML, or `javascript:` URLs. Use local fragment references such as `url(#gradient)` only.
- Do not embed images as base64 data in the JSON. Do not use `data:` image references in SVG.
- Use a separate file for each independently assigned figure. If an image is reused intentionally, reference the same filename only when the image content is exactly the same.
- Avoid duplicate filenames, including filenames that differ only by uppercase/lowercase.

## Before returning the files, check all of these

1. The JSON parses without repair.
2. Every subject and section name is deliberate and consistent.
3. Section names, question IDs, and image filenames are unique as required.
4. The test total equals the sum of section counts; each section count equals its question array length.
5. Every MCQ/MULTI has options A–D in that order and the answer key matches those options.
6. Every NUM answer is numeric or a valid structured range.
7. Every question has either text or an image; every referenced image exists.
8. Every marking value uses the signed convention above.
9. Answers and solutions have been transcribed accurately, without invented values.
10. No images are missing, mislabeled, or associated based only on uncertain page order.
