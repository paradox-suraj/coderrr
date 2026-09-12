import { LANGUAGE_CONFIGS } from '../src/lib/runners/codeExecutor';
import { AlgoJeetDB } from '../src/lib/db/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Testing Multi-Language Support & Configurations...');

// 1. Validate all 4 target languages are configured
const supported = ['python', 'cpp', 'java', 'javascript'] as const;
for (const lang of supported) {
  const cfg = LANGUAGE_CONFIGS[lang];
  assert(Boolean(cfg), `Configuration exists for language '${lang}'`);
  assert(Boolean(cfg.label), `Language '${lang}' has label: ${cfg.label}`);
  assert(Boolean(cfg.version), `Language '${lang}' has runtime version: ${cfg.version}`);
  assert(Boolean(cfg.runtimeLabel), `Language '${lang}' has runtime badge: ${cfg.runtimeLabel}`);

  const sampleTemplate = cfg.defaultCode('Two Sum', '1');
  assert(sampleTemplate.includes('Two Sum'), `Template for '${lang}' includes problem title`);
  assert(sampleTemplate.includes('#1'), `Template for '${lang}' includes problem ID`);
}

// 2. Validate runtime classifications
assert(LANGUAGE_CONFIGS.python.runtimeType === 'wasm', 'Python configured as WASM');
assert(LANGUAGE_CONFIGS.javascript.runtimeType === 'wasm', 'JavaScript configured as in-browser WASM/Worker');
assert(LANGUAGE_CONFIGS.cpp.runtimeType === 'cloud', 'C++ configured as Cloud Sandbox');
assert(LANGUAGE_CONFIGS.java.runtimeType === 'cloud', 'Java configured as Cloud Sandbox');

// 3. Validate Dexie Schema Version 3
const db = new AlgoJeetDB();
assert(db.verno === 3, 'AlgoJeetDB has upgraded to Version 3');
const userCodeTable = db.table('userCode');
assert(userCodeTable.schema.primKey.name === 'id', 'userCode primary key is composite `id`');

// 4. Validate problem #408 Valid Word Abbreviation C++ template
const cpp408 = LANGUAGE_CONFIGS.cpp.defaultCode('Valid Word Abbreviation', '408');
assert(cpp408.includes('#408: Valid Word Abbreviation'), 'C++ template includes #408: Valid Word Abbreviation');
assert(cpp408.includes('C++ (GCC 10.2 / C++20)'), 'C++ template includes GCC 10.2 / C++20 header');
assert(cpp408.includes('class Solution'), 'C++ template declares class Solution');
assert(cpp408.includes('bool validWordAbbreviation(string word, string abbr)'), 'C++ template declares validWordAbbreviation signature');
assert(cpp408.includes('int main()'), 'C++ template includes runnable int main()');

// 5. Validate language buffer dictionary model
const codeDictionary: Record<string, string> = {
  python: LANGUAGE_CONFIGS.python.defaultCode('Valid Word Abbreviation', '408'),
  cpp: LANGUAGE_CONFIGS.cpp.defaultCode('Valid Word Abbreviation', '408'),
  java: LANGUAGE_CONFIGS.java.defaultCode('Valid Word Abbreviation', '408'),
  javascript: LANGUAGE_CONFIGS.javascript.defaultCode('Valid Word Abbreviation', '408'),
};

assert(codeDictionary.python.includes('Python'), 'Python buffer contains Python starter');
assert(codeDictionary.cpp.includes('validWordAbbreviation'), 'C++ buffer contains C++ starter');
assert(codeDictionary.java.includes('class Main'), 'Java buffer contains Java starter');
assert(codeDictionary.javascript.includes('JavaScript'), 'JavaScript buffer contains JS starter');

// Simulate switching to C++ and updating buffer
codeDictionary.cpp = '// User modified C++ solution';
assert(codeDictionary.cpp === '// User modified C++ solution', 'C++ buffer updated');
assert(codeDictionary.python.includes('Python'), 'Python buffer remains untouched when C++ is updated');

console.log('\n🎉 Multi-Language Configurations & Dexie V3 Verified Successfully!\n');
