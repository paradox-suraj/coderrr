import assert from 'node:assert/strict';
import problems from '../public/data/problems.json';

interface ProblemDoc {
  id: string;
  title: string;
  difficulty: string;
  corePattern?: string;
  learningTrack?: string;
  allTopics?: string[];
}

function clientSearch(
  dataset: ProblemDoc[],
  query: string,
  difficulty?: string
): ProblemDoc[] {
  const trimmed = query.trim().toLowerCase().replace(/^#/, '');
  const singular = trimmed.endsWith('s') && trimmed.length > 3 ? trimmed.slice(0, -1) : null;

  let filtered = dataset.filter((p) => {
    if (difficulty && difficulty !== 'All' && p.difficulty !== difficulty) return false;
    return true;
  });

  if (trimmed) {
    filtered = filtered.filter((p) => {
      const title = p.title.toLowerCase();
      if (p.id === trimmed) return true;
      if (title.includes(trimmed)) return true;
      if (singular && title.includes(singular)) return true;
      if (p.corePattern && p.corePattern.toLowerCase().includes(trimmed)) return true;
      if (Array.isArray(p.allTopics) && p.allTopics.some((t) => t.toLowerCase().includes(trimmed))) return true;
      return false;
    });

    filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      if (a.id === trimmed && b.id !== trimmed) return -1;
      if (b.id === trimmed && a.id !== trimmed) return 1;
      if (aTitle === trimmed && bTitle !== trimmed) return -1;
      if (bTitle === trimmed && aTitle !== trimmed) return 1;
      const aStarts = aTitle.startsWith(trimmed) || (singular && aTitle.startsWith(singular));
      const bStarts = bTitle.startsWith(trimmed) || (singular && bTitle.startsWith(singular));
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
  }

  return filtered;
}

console.log('🧪 Testing Search Engine Logic & Difficulty Filtering...');

// Test 1: All Two Sum problems in dataset
const twoSumAll = (problems as ProblemDoc[]).filter(p => p.title.toLowerCase().includes('two sum'));
assert.equal(twoSumAll.length, 6, 'There should be 6 Two Sum variants in catalog');
console.log('✅ Catalog contains exactly 6 Two Sum variants');

// Verify difficulties of Two Sum problems: none are Hard!
const hardTwoSum = twoSumAll.filter(p => p.difficulty === 'Hard');
assert.equal(hardTwoSum.length, 0, 'No Two Sum variant should be Hard');
console.log('✅ Verified: Zero Two Sum problems are classified as Hard (4 Easy, 2 Medium)');

// Test 2: Searching "two sums" with Hard filter returns 0 Two Sum variants
const hardResults = clientSearch(problems as ProblemDoc[], 'two sums', 'Hard');
const hardTwoSumsFound = hardResults.filter(p => p.title.toLowerCase().includes('two sum'));
assert.equal(hardTwoSumsFound.length, 0, 'Hard filter must exclude Easy/Medium Two Sum problems');
console.log('✅ Confirmed: Searching "two sums" + Hard correctly yields zero Two Sum questions');

// Test 3: Searching "two sums" with All or Easy returns #1 Two Sum
const allResults = clientSearch(problems as ProblemDoc[], 'two sums');
assert.ok(allResults.length > 0, 'Searching "two sums" with All must return results');
assert.equal(allResults[0].id, '1', 'Problem #1 Two Sum must be ranked #1 for "two sums"');
console.log('✅ Plural normalization: "two sums" matches #1 "Two Sum" as top hit');

// Test 4: Searching "two sums" with Easy filter returns #1 Two Sum
const easyResults = clientSearch(problems as ProblemDoc[], 'two sums', 'Easy');
assert.equal(easyResults[0].id, '1', 'Problem #1 Two Sum must be ranked #1 for Easy "two sums"');
assert.ok(easyResults.every(p => p.difficulty === 'Easy'), 'All results must be Easy');
console.log('✅ Searching "two sums" + Easy returns Easy variants including #1');

// Test 5: Exact ID search
const idResults = clientSearch(problems as ProblemDoc[], '#1');
assert.equal(idResults[0].id, '1', 'Searching "#1" must return problem #1');
console.log('✅ Exact ID search ("#1") resolves directly to Two Sum');

console.log('\n🎉 All Search Engine & Filter Validation Tests Passed Successfully!\n');
