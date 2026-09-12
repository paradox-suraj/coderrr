export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  explanation?: string;
  isCustom?: boolean;
}

export interface TestCaseResult {
  caseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stdout?: string;
  stderr?: string;
  executionTimeMs: number;
  error?: string;
}

export function cleanHtmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Extracts official test cases from problem statement HTML
 */
export function parseTestCasesFromHtml(html?: string): TestCase[] {
  if (!html) return [];

  const testCases: TestCase[] = [];
  const clean = cleanHtmlText;

  // Pattern 1: Example blocks with Input / Output (pre, example-block, or strong headers)
  const blockRegex = /(?:<strong class="example">Example \d+:<\/strong>|<pre>|<div class="example-block">)([\s\S]*?)(?=(?:<strong class="example">Example \d+:<\/strong>|<pre>|<div class="example-block">|<p><strong>Constraints:|<p>&nbsp;<\/p>\s*<p><strong>Constraints:|$))/gi;

  let blockMatch: RegExpExecArray | null;
  let index = 1;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const blockContent = blockMatch[1];
    
    // Extract input
    const inputMatch =
      /Input:?\s*<\/strong>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|<strong>Output)/i.exec(blockContent) ||
      /Input:?\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|Output:)/i.exec(blockContent);

    // Extract output
    const outputMatch =
      /Output:?\s*<\/strong>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|<strong>Explanation|$)/i.exec(blockContent) ||
      /Output:?\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|<br>|Explanation:|$)/i.exec(blockContent);

    // Extract explanation
    const expMatch =
      /Explanation:?\s*<\/strong>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|$)/i.exec(blockContent) ||
      /Explanation:?\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/p>|$)/i.exec(blockContent);

    if (inputMatch && outputMatch) {
      const inputStr = clean(inputMatch[1]);
      const outputStr = clean(outputMatch[1]);
      if (inputStr && outputStr) {
        testCases.push({
          id: `case-${index}`,
          input: inputStr,
          expectedOutput: outputStr,
          explanation: expMatch ? clean(expMatch[1]) : undefined,
        });
        index++;
      }
    }
  }

  // Fallback: If no structured examples parsed, search for any "Input:" and "Output:" lines
  if (testCases.length === 0) {
    const fallbackRegex = /Input:\s*([^\n\r<]+)[\s\S]*?Output:\s*([^\n\r<]+)/gi;
    let fbMatch: RegExpExecArray | null;
    let fbIndex = 1;
    while ((fbMatch = fallbackRegex.exec(html)) !== null) {
      const inputStr = clean(fbMatch[1]);
      const outputStr = clean(fbMatch[2]);
      if (inputStr && outputStr) {
        testCases.push({
          id: `case-${fbIndex}`,
          input: inputStr,
          expectedOutput: outputStr,
        });
        fbIndex++;
      }
    }
  }

  return testCases;
}

/**
 * Normalizes output comparison between actual and expected values
 * Handles array whitespace, boolean casing, floating-point numbers, and JSON representation.
 */
export function compareOutputs(actual: string, expected: string): boolean {
  if (actual === expected) return true;

  const cleanActual = actual.trim();
  const cleanExpected = expected.trim();

  if (cleanActual === cleanExpected) return true;

  // Case-insensitive boolean comparison
  if (
    cleanActual.toLowerCase() === cleanExpected.toLowerCase() &&
    (cleanActual.toLowerCase() === 'true' || cleanActual.toLowerCase() === 'false')
  ) {
    return true;
  }

  // Numerical equivalence
  const numActual = Number(cleanActual);
  const numExpected = Number(cleanExpected);
  if (!Number.isNaN(numActual) && !Number.isNaN(numExpected) && numActual === numExpected) {
    return true;
  }

  // Strip surrounding quotes if present (e.g. '"apple"' vs 'apple')
  const unquote = (s: string) => {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.substring(1, s.length - 1);
    }
    return s;
  };
  if (unquote(cleanActual) === unquote(cleanExpected)) {
    return true;
  }

  // JSON Array/Object structure equivalence (e.g. [0, 1] vs [0,1])
  try {
    const parsedActual = JSON.parse(cleanActual);
    const parsedExpected = JSON.parse(cleanExpected);
    if (JSON.stringify(parsedActual) === JSON.stringify(parsedExpected)) {
      return true;
    }
    // Also compare order-independent if both are arrays of primitives and sorted representations match
    if (
      Array.isArray(parsedActual) &&
      Array.isArray(parsedExpected) &&
      parsedActual.length === parsedExpected.length
    ) {
      const sortedActual = [...parsedActual].sort();
      const sortedExpected = [...parsedExpected].sort();
      if (JSON.stringify(sortedActual) === JSON.stringify(sortedExpected)) {
        return true;
      }
    }
  } catch {
    // If not JSON, ignore
  }

  // Remove internal whitespaces (e.g. "[0, 1]" -> "[0,1]")
  const strippedActual = cleanActual.replace(/\s+/g, '');
  const strippedExpected = cleanExpected.replace(/\s+/g, '');
  if (strippedActual === strippedExpected) {
    return true;
  }

  return false;
}
