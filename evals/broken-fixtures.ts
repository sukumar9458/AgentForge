export interface BrokenFixture {
  id: string;
  title: string;
  userPrompt: string;
  brokenCoderOutput: string;
}

/** Known-bad first drafts used to measure Critic recovery, not Gemini quality. */
export const BROKEN_CODE_FIXTURES: BrokenFixture[] = [
  {
    id: "py-syntax",
    title: "Python syntax error",
    userPrompt: "Write Python that prints the numbers 1 through 5.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`python
for i in range(1, 6)
    print(i)
\`\`\`
`,
  },
  {
    id: "py-missing-file",
    title: "Python missing file",
    userPrompt: "Read eval_missing_file.txt and print it without crashing.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`python
with open("eval_missing_file.txt") as f:
    print(f.read())
\`\`\`
`,
  },
  {
    id: "py-div-zero",
    title: "Python divide by zero",
    userPrompt: "Divide 10 by 0 safely and print a message. Process must exit 0.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`python
print(10 / 0)
\`\`\`
`,
  },
  {
    id: "js-throw",
    title: "JavaScript uncaught throw",
    userPrompt: "Parse JSON '{bad' and print invalid if it fails. Do not crash.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`javascript
console.log(JSON.parse("{bad"));
\`\`\`
`,
  },
  {
    id: "ts-undef",
    title: "TypeScript crash on undefined",
    userPrompt: "Print the length of a name. If name is missing, print 0. Do not crash.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`typescript
const user: { name?: string } = {};
console.log(user.name.length);
\`\`\`
`,
  },
  {
    id: "py-infinite",
    title: "Python infinite loop",
    userPrompt: "Count and print 1 through 5 only. No infinite loop.",
    brokenCoderOutput: `[Coder Output]:
\`\`\`python
i = 1
while True:
    print(i)
    i += 1
\`\`\`
`,
  },
];
