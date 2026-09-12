import {describe,test,expect} from 'bun:test';
import {mkdirSync,mkdtempSync,readdirSync,writeFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withoutGitEnv} from '../check-config';

test('test Git operations cannot replace the committing worktree index',()=>{
 const owner=realpathSync(mkdtempSync(join(tmpdir(),'poneglyph-hook-owner-')));
 const foreign=realpathSync(mkdtempSync(join(tmpdir(),'poneglyph-hook-foreign-')));
 const git=(root:string,args:string[],env:NodeJS.ProcessEnv=process.env)=>execFileSync('git',['-C',root,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 // The suite itself may run inside a hook. Both fixtures must start clean.
 const clean=withoutGitEnv(process.env);
 for(const root of [owner,foreign])git(root,['init','--quiet'],clean);
 writeFileSync(join(owner,'owner.txt'),'Keep this staged content');git(owner,['add','.'],clean);
 const before=git(owner,['write-tree'],clean);
 const inherited={...clean,GIT_DIR:join(owner,'.git'),GIT_WORK_TREE:owner,GIT_INDEX_FILE:join(owner,'.git','index'),GIT_PREFIX:'nested/',KEEP_TEST_VALUE:'kept'};
 const isolated:NodeJS.ProcessEnv=withoutGitEnv(inherited);
 for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_PREFIX'])expect(isolated[key]).toBeUndefined();
 expect(isolated.KEEP_TEST_VALUE).toBe('kept');expect(inherited.GIT_INDEX_FILE).toBe(join(owner,'.git','index'));
 writeFileSync(join(foreign,'foreign.txt'),'Foreign fixture');git(foreign,['add','.'],isolated);
 expect(git(foreign,['ls-files'],isolated)).toBe('foreign.txt');
 expect(git(owner,['write-tree'],clean)).toBe(before);
});

// Quality review 2026-09-11 — H33. The test above exercises `withoutGitEnv` only: it
// never spawns pre-commit.ts and never reaches `indexTree()`, so deleting the guard
// left the suite green. These two runs drive the real script end to end. They are a
// PAIR on purpose: exit 2 is the catch-all, so a broken fixture fails identically.
// The control run proves the fixture is a valid `core` tree whose inner suite ran.
describe('pre-commit.ts drives the staged-index guard (H33)',()=>{
 const HOOK=join(import.meta.dir,'..','pre-commit.ts');
 // `claude plugin validate` runs on the green path and would reject a minimal fixture.
 // Drop only the PATH entries that expose the CLI; git and bun must stay reachable.
 const pathWithoutClaude=(value:string|undefined)=>(value??'').split(delimiter).filter(dir=>{
  if(!dir)return false;
  try{return !readdirSync(dir).some(e=>/^claude(\.[^.]+)?$/i.test(e));}catch{return true;}
 }).join(delimiter);

 const fixture=(innerTest:string)=>{
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'poneglyph-hook-run-')));
  const clean=withoutGitEnv(process.env);
  execFileSync('git',['-C',root,'init','--quiet'],{env:clean,stdio:'ignore'});
  mkdirSync(join(root,'.claude','skills','a'),{recursive:true});
  mkdirSync(join(root,'.claude','__tests__'),{recursive:true});
  writeFileSync(join(root,'.claude','skills','a','SKILL.md'),'---\nname: a\ndescription: A fixture skill so the inventory is not empty.\n---\nFixture body.\n');
  writeFileSync(join(root,'.claude','__tests__','inner.test.ts'),innerTest);
  execFileSync('git',['-C',root,'add','.'],{env:clean,stdio:'ignore'});
  return root;
 };

 const runHook=(root:string)=>{
  const env={...withoutGitEnv(process.env),PATH:pathWithoutClaude(process.env.PATH)};
  const r=Bun.spawnSync([process.execPath,HOOK],{cwd:root,env,stdout:'pipe',stderr:'pipe'});
  return {code:r.exitCode,out:r.stdout.toString(),err:r.stderr.toString()};
 };

 test('accepts a core tree whose tests leave the staged index alone',()=>{
  const r=runHook(fixture("import {test,expect} from 'bun:test';\ntest('benign',()=>{expect(1).toBe(1);});\n"));
  expect(r.out+r.err).toContain('core:'); // check() ran and classified the fixture
  expect(r.out+r.err).toContain('1 pass'); // and the inner suite really ran, not an empty match
  expect(r.code).toBe(0);
 });

 test('blocks the commit when the test run rewrites the staged index',()=>{
  const mutating="import {test,expect} from 'bun:test';\nimport {writeFileSync} from 'node:fs';\nimport {execFileSync} from 'node:child_process';\ntest('mutates the index',()=>{writeFileSync('sneaky.txt','x');execFileSync('git',['add','sneaky.txt'],{stdio:'ignore'});expect(1).toBe(1);});\n";
  const r=runHook(fixture(mutating));
  // `indexTree() !== before` throws inside the try, so the catch-all reports 2, not 1.
  expect(r.err).toContain('Commit blocked');
  expect(r.code).toBe(2);
 });
});
