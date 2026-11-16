import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function uuidFromOutput(output){const uuid=output.match(/UUID: ([A-Fa-f0-9-]+) \(arm64\)/)?.[1];if(!uuid)throw Error('Could not verify arm64 Hermes UUID.');return uuid.toUpperCase();}
export function assertReleaseHermes(actual,expected){if(actual!==expected)throw Error(`Release blocked: Hermes ${actual} does not match Release artifact ${expected}. Run ios:release:prepare and rebuild in clean derived data.`);}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function uuid(file){return uuidFromOutput(execFileSync('xcrun',['dwarfdump','--uuid',file],{encoding:'utf8'}));}
export function runGuard(mode,archive){
 const pods=path.join(root,'ios/Pods');
 if(mode==='prepare'){
  // pod install can restore Debug Hermes while leaving this Release marker intact.
  // Force React Native's build phase to unpack the selected configuration again.
  writeFileSync(path.join(pods,'.last_build_configuration'),'RebuildRequired');
  console.log('Hermes configuration marker invalidated. Build Release, then verify archive before upload.');return;
 }
 if(mode!=='verify'||!archive)throw Error('Usage: node scripts/ios-release-guard.mjs prepare | verify <archive.xcarchive>');
 const version=JSON.parse(readFileSync(path.join(root,'node_modules/react-native/package.json'),'utf8')).version;
 const scratch=mkdtempSync(path.join(tmpdir(),'substrate-release-hermes-'));
 try{
  const member='destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64/hermes.framework/hermes';
  execFileSync('tar',['-xzf',path.join(pods,`hermes-engine-artifacts/hermes-ios-${version}-release.tar.gz`),'-C',scratch,member]);
  const expected=uuid(path.join(scratch,member));
  const actual=uuid(path.resolve(archive,'Products/Applications/SubstrateBeta.app/Frameworks/hermes.framework/hermes'));
  assertReleaseHermes(actual,expected);console.log(`Release Hermes verified: ${actual}`);
 }finally{rmSync(scratch,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{runGuard(process.argv[2],process.argv[3]);}catch(e){console.error(e.message);process.exitCode=1;}}
