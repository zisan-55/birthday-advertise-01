import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {check,loadConfiguration,validateClient,validateEffectiveAssets,root} from './validate-client.mjs';

const loaded = await check();
const {buildBirthdayConfig,allocatePhotoSections,allClientPhotos,getCountdown,CLIENT_ARTWORK_MODE} = loaded;
const template = JSON.parse(readFileSync(join(root,'src/config/client.json'),'utf8'));
const layout = JSON.parse(readFileSync(join(root,'scripts/fixtures/layout.json'),'utf8'));
const app = readFileSync(join(root,'src/App.tsx'),'utf8');
const renderer = new Function('sourcePhotos','birthdayConfig',app.slice(app.indexOf('  const columnPositions ='),app.indexOf('  function moveCamera('))+'return photos;');
const publicRoot=resolve(root,'public');
const mediaDir=mkdtempSync(join(publicRoot,'.photo-system-test-'));
mkdirSync(join(root,'.tmp'),{recursive:true});
const scratch=mkdtempSync(join(root,'.tmp','client-tests-'));
let scenarios=0;
let invalidCases=0;
const packages=[];
try {
  const photos=Array.from({length:20},(_,i)=>{
    const file=join(mediaDir,`photo-${i+1}.svg`);
    writeFileSync(file,`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50"><rect width="40" height="50" fill="hsl(${i*17} 50% 50%)"/><title>Test illustration ${i+1}</title></svg>`);
    return {src:'/'+relative(publicRoot,file).replaceAll('\\','/'),alt:`Test photograph ${i+1}`,caption:`Test caption ${i+1}`};
  });
  const duplicate=join(mediaDir,'same-content.svg');writeFileSync(duplicate,readFileSync(join(mediaDir,'photo-1.svg')));
  const empty=join(mediaDir,'empty.svg');writeFileSync(empty,'');
  function clientFor(count,coupleCount) {
    const c=structuredClone(template);c.siteId=`validation-fixture-${count}`;c.photoPackage=count;
    c.photos={regular:photos.slice(0,count-coupleCount),couple:photos.slice(count-coupleCount,count)};
    return c;
  }
  for(const count of [10,15,20]) {
    for(let couples=0;couples<=count;couples++) {
      const c=clientFor(count,couples);
      assert.deepEqual(validateClient(c,getCountdown),[]);
      const sections=allocatePhotoSections(c.photos);
      assert.deepEqual(sections,allocatePhotoSections(c.photos),'Allocation must be deterministic');
      assert.deepEqual(Object.values(sections).map(p=>p.length),[5,10,16,35]);
      const expected=[...c.photos.regular,...c.photos.couple];
      assert.deepEqual(sections.universe.slice(0,count),expected,'Every supplied photo must appear before Universe reuse');
      assert.equal(new Set(sections.universe.map(p=>p.src)).size,count);
      const priority=[...c.photos.couple,...c.photos.regular];
      assert.deepEqual(sections.scrapbook.slice(0,Math.min(couples,16)),priority.slice(0,Math.min(couples,16)),'Couple photos must have first priority in scrapbook');
      assert.deepEqual(sections.carousel.slice(0,Math.min(c.photos.regular.length,5)),c.photos.regular.slice(0,5));
      assert.deepEqual(sections.memories.slice(0,Math.min(c.photos.regular.length,10)),c.photos.regular.slice(0,10));
      for(const section of Object.values(sections)) {
        section.forEach((p,i)=>{assert.ok(expected.some(source=>source.src===p.src));if(i)assert.notEqual(p.src,section[i-1].src);});
        assert.notEqual(section[0].src,section.at(-1).src,'Cyclic section boundary must avoid duplicate neighbors');
      }
      const cfg=buildBirthdayConfig(c);
      assert.deepEqual(validateEffectiveAssets(cfg),[]);
      assert.deepEqual(loaded.validateBirthdayConfig(cfg),[]);
      assert.deepEqual([cfg.photoCarousel.photos.length,cfg.gallery.photos.length,cfg.scrapbook.pages.length,cfg.scrapbook.pages.flatMap(p=>p.photos).length,cfg.photoUniverse.photos.length],[5,10,8,16,35]);
      assert.deepEqual(cfg.gallery.photos.map(({id,rotation,size,sticker})=>({id,rotation,size,sticker})),layout.gallery);
      assert.deepEqual(cfg.scrapbook.pages.map(({id,title,paperColor,photos,stickers})=>({id,title,paperColor,photos:photos.map(({rotation})=>({rotation})),stickers})),layout.scrapbook);
      const frames=renderer(cfg.photoUniverse.photos,cfg);
      assert.equal(frames.length,35);
      assert.deepEqual(frames.map(({scale,rotation,position})=>({scale,rotation,position})),layout.universe,'All 35 Universe frame positions/layers/scales/rotations must match pre-change geometry');
      assert.equal(new Set(frames.map(p=>p.src)).size,count);
      assert.equal(new Set(frames.map(p=>p.id)).size,35);
      assert.equal(cfg.audio.artwork,CLIENT_ARTWORK_MODE==='first-photo'?expected[0].src:layout.configuredArtwork);
      assert.equal(cfg.gallery.photos[0].caption,sections.memories[0].caption);
      assert.equal(cfg.scrapbook.pages[0].photos[0].caption,sections.scrapbook[0].caption);
      scenarios++;
    }
    const c=clientFor(count,Math.floor(count/3));
    const compiled=await loadConfiguration(c);
    assert.equal(new Set(compiled.birthdayConfig.photoUniverse.photos.map(p=>p.src)).size,count,'JSON-to-config integration must cover the entire package');
    assert.equal(compiled.birthdayConfig.siteId,c.siteId);
    packages.push(c);
  }
  const good=clientFor(10,3);
  const mutations=[
    ['photoPackage',c=>c.photoPackage=35],['photoPackage',c=>c.photoPackage=12],['photoPackage',c=>c.photoPackage='10'],
    ['must equal',c=>c.photos.couple.push(photos[12])],['must equal',c=>c.photos.regular.pop()],
    ['duplicates',c=>c.photos.couple[0]=c.photos.regular[0]],
    ['duplicates',c=>c.photos.regular[1]={src:c.photos.regular[0].src.slice(1)}],
    ['file content',c=>c.photos.regular[1]={src:'/'+relative(publicRoot,duplicate).replaceAll('\\','/')}],
    ['must be an object',c=>c.photos=[]],['must be an array',c=>c.photos.couple=null],['Unknown photo category',c=>c.photos.other=[]],
    ['must be a photo object',c=>c.photos.regular[0]=null],['supported extension',c=>c.photos.regular[0].src=42],
    ['supported extension',c=>c.photos.regular[0].src='/../outside.jpg'],['supported extension',c=>c.photos.regular[0].src='https://example.com/photo.jpg'],
    ['missing, empty or unsafe',c=>c.photos.regular[0].src='/missing.jpg'],['missing, empty or unsafe',c=>c.photos.regular[0].src='/'+relative(publicRoot,empty).replaceAll('\\','/')],
    ['recipient.name',c=>c.recipient.name=''],['recipient.nickname',c=>c.recipient.nickname=''],['sender.name',c=>c.sender.name=''],['siteId',c=>c.siteId=''],
    ['recipient.age',c=>c.recipient.age=0],['Birthday date',c=>c.recipient.birthdayDate='2026-02-30'],['Birthday date',c=>c.recipient.birthdayTime='25:00'],['Birthday date',c=>c.recipient.timezone='Invalid/Zone'],
    ['messages',c=>c.messages=null],['Unknown messages',c=>c.messages.unknown='wrong'],['messages.reveal',c=>c.messages.reveal=''],
    ['music.src',c=>c.music.src='/missing.mp3'],['music.title',c=>{c.music.src='/audio/birthday-song.mp3';c.music.title=null;}],['music.artwork',c=>c.music.artwork='/missing.svg'],
    ['scrapbookNotes',c=>c.scrapbookNotes=[]],['scrapbookNotes',c=>c.scrapbookNotes[0]=['only one']],['caption',c=>c.photos.couple[0].caption=42],
  ];
  for(const [label,mutate]of mutations){const c=structuredClone(good);mutate(c);const errors=validateClient(c,getCountdown);assert.ok(errors.some(e=>e.includes(label)),`${label}: ${errors.join('; ')}`);invalidCases++;}
  assert.ok(validateClient(null,getCountdown).length);invalidCases++;
  const badFile=join(scratch,'invalid-client.json');writeFileSync(badFile,JSON.stringify({...good,photoPackage:35}));
  const result=spawnSync(process.execPath,[join(root,'scripts/validate-client.mjs'),badFile],{encoding:'utf8',cwd:root});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Client validation failed:[\s\S]*photoPackage/);
  const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));assert.match(pkg.scripts.prebuild,/npm run validate/);assert.match(pkg.scripts.prebuild,/npm test/);
  const custom=structuredClone(good);custom.music={src:'/audio/birthday-song.mp3',title:'Custom track',artwork:photos[8].src};custom.messages.closing='A custom wish.';custom.scrapbookNotes[0]=['First custom note.','Second custom note.'];
  assert.deepEqual(validateClient(custom,getCountdown),[]);const cc=buildBirthdayConfig(custom);assert.equal(cc.audio.artwork,photos[8].src);assert.equal(cc.audio.title,'Custom track');assert.equal(cc.closing.message,'A custom wish.');assert.deepEqual(cc.scrapbook.pages[0].notes,custom.scrapbookNotes[0]);
  if(process.argv.includes('--build-packages')) {
    const {build}=await import('vite');
    const jsonPath=resolve(root,'src/config/client.json').replaceAll('\\','/');
    for(const fixture of packages){
      const outDir=join(root,'.build-check','packages',String(fixture.photoPackage));
      await build({root,configFile:join(root,'vite.config.ts'),logLevel:'error',build:{outDir,emptyOutDir:false},plugins:[{name:'package-test-client',enforce:'pre',transform(code,id){if(id.split('?')[0].replaceAll('\\','/')===jsonPath)return{code:JSON.stringify(fixture),map:null};}}]});
      const bundles=readdirSync(join(outDir,'assets')).filter(file=>file.endsWith('.js')).map(file=>readFileSync(join(outDir,'assets',file),'utf8')).join('\n');
      assert.ok(bundles.includes(fixture.siteId),'Build must contain the fixture, not the default client');
      console.log(`Production fixture build passed: ${fixture.photoPackage} photos (${fixture.photos.couple.length} couple).`);
    }
  }
  console.log(`PASS: ${scenarios} package/category combinations; ${invalidCases} invalid-input cases; 5/10/16/35 frames; all supplied photos covered; couple priority; unchanged frame geometry/artwork policy; invalid CLI exit.`);
} finally {
  // Remove only newly created test directories whose absolute paths are inside this checkout.
  for(const [directory,parent]of [[mediaDir,publicRoot],[scratch,join(root,'.tmp')]]){
    const rel=relative(parent,directory);assert.ok(rel&&!rel.startsWith('..')&&!resolve(directory).includes('node_modules'));
    rmSync(directory,{recursive:true,force:true});
  }
}
