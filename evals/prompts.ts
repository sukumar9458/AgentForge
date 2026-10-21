export interface EvalPrompt {
  id: string;
  title: string;
  prompt: string;
}

/**
 * Coding tasks that must include a runnable markdown code block.
 * Scoring is runtime-only: crash, non-zero exit, timeout, or no executable block.
 */
export const CODE_ERROR_PROMPTS: EvalPrompt[] = [
  {
    id: "hello-py",
    title: "Hello world (Python)",
    prompt:
      "Write a Python script that prints the exact text Hello World. Put the code in a python markdown code block.",
  },
  {
    id: "sum-js",
    title: "Sum 1 to 10 (JavaScript)",
    prompt:
      "Write a JavaScript program that sums integers from 1 to 10 and prints the result. Use a javascript markdown code block and actually run the calculation (do not only define a function).",
  },
  {
    id: "factorial-ts",
    title: "Factorial (TypeScript)",
    prompt:
      "Write TypeScript that computes factorial(6) and prints it. Use a typescript markdown code block. Include a function call so the file executes.",
  },
  {
    id: "fizzbuzz-py",
    title: "FizzBuzz 1-15 (Python)",
    prompt:
      "Write Python FizzBuzz for numbers 1 through 15, printing one result per line. Use a python markdown code block.",
  },
  {
    id: "reverse-js",
    title: "Reverse string (JavaScript)",
    prompt:
      "Write JavaScript that reverses the string 'AgentForge' and prints the reversed value. Use a javascript markdown code block.",
  },
  {
    id: "binary-search-py",
    title: "Binary search demo (Python)",
    prompt:
      "Write Python that implements binary search over the sorted list [1,3,5,7,9,11]. Search for 7 and print the index. If not found print -1. Use a python markdown code block and call the function.",
  },
  {
    id: "two-sum-ts",
    title: "Two sum (TypeScript)",
    prompt:
      "Write TypeScript two-sum: nums = [2,7,11,15], target = 9. Print the two indices. Use a typescript markdown code block and execute it.",
  },
  {
    id: "parens-js",
    title: "Valid parentheses (JavaScript)",
    prompt:
      "Write JavaScript that checks whether '()[]{}' is valid parentheses and prints true or false. Use a javascript markdown code block.",
  },
  {
    id: "missing-file-py",
    title: "Read missing file (Python)",
    prompt:
      "Write a Python script that reads a file named eval_missing_file.txt from the current directory and prints its contents. Use a python markdown code block. The script must finish without crashing even if the file does not exist.",
  },
  {
    id: "div-zero-js",
    title: "Safe divide (JavaScript)",
    prompt:
      "Write JavaScript that divides 10 by 0 using integer-like math on a variable that is 0, then prints a fallback message instead of throwing. Use a javascript markdown code block. The process must exit with code 0.",
  },
  {
    id: "json-parse-ts",
    title: "Parse bad JSON (TypeScript)",
    prompt:
      "Write TypeScript that tries to JSON.parse the string '{not json' and prints 'invalid' if parsing fails. Use a typescript markdown code block. Do not let the process crash.",
  },
  {
    id: "bounded-loop-py",
    title: "Bounded loop (Python)",
    prompt:
      "Write Python that counts from 1 upward and prints numbers, but it MUST stop after 5 numbers (no infinite loop). Use a python markdown code block.",
  },
];
