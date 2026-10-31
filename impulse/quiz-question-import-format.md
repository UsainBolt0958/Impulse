# Quiz Question Import Format

The Admin Portal's **Quiz questions** section accepts one JSON file containing up to 500 four-option multiple-choice questions. Every question must have a subject and chapter so it can be selected in a friend challenge.

```json
{
  "questions": [
    {
      "subject": "Physics",
      "chapter": "Motion in 1D",
      "question": "A car travels 100 m in 5 s. What is its average speed?",
      "options": {
        "A": "10 m/s",
        "B": "20 m/s",
        "C": "50 m/s",
        "D": "500 m/s"
      },
      "answer": "B",
      "explanation": "Average speed is distance divided by time.",
      "difficulty": "Easy"
    }
  ]
}
```

`questions` may also be a top-level array. Use `question`, `question_text`, or `text` for question text; `answer`, `correct_answer`, or `correctAnswer` for the correct option key; and `explanation` or `solution` for the optional explanation. Options may be an object with `A`, `B`, `C`, and `D` keys or an array of four strings in that order. A top-level `subject` and `chapter` can provide defaults, but individual questions may override either value.

Every question needs non-empty question text, four non-empty options, a correct answer of `A`, `B`, `C`, or `D`, a subject, and a chapter. Difficulty defaults to `Medium` unless it is `Easy`, `Medium`, or `Hard`. Successful imports are added to the shared question library and available to create chapter-based challenges.
