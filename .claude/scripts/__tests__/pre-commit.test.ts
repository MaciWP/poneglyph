import {test,expect} from 'bun:test';
import {mkdtempSync,writeFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
