#!/usr/bin/env python3
"""Verify Petal's ad-hoc Mach-O page hashes and bundle resources on Linux.

Usage: python3 tools/verify-macos.py path/to/Petal.app
This validates integrity, not Apple notarization or macOS launch eligibility.
It independently checks Apple's CodeDirectory hashes because rcodesign 0.29.0
reports an empty-CMS parse error for its own valid ad-hoc signatures.
"""
from pathlib import Path
import hashlib,plistlib,struct,sys
if len(sys.argv)!=2:
 raise SystemExit(__doc__)
bundle=Path(sys.argv[1]).resolve()
if not bundle.is_dir():
 raise SystemExit(f'Missing app bundle: {bundle}')
count=0;pages=0;resources=0;bundle_hashes={}

def check_macho(path,data):
 global count,pages
 magic=data[:4]
 if magic==b'\xca\xfe\xba\xbe':
  n=struct.unpack_from('>I',data,4)[0]
  for i in range(n):
   _,_,offset,size,_=struct.unpack_from('>5I',data,8+i*20)
   check_macho(path,data[offset:offset+size])
  return
 if magic!=b'\xcf\xfa\xed\xfe':return
 ncmds=struct.unpack_from('<I',data,16)[0];offset=32;signature=None
 for _ in range(ncmds):
  cmd,size=struct.unpack_from('<II',data,offset)
  if cmd==0x1d:
   start,length=struct.unpack_from('<II',data,offset+8);signature=data[start:start+length]
  offset+=size
 assert signature is not None,('Unsigned',path)
 smagic,slength,n=struct.unpack_from('>III',signature,0)
 assert smagic==0xfade0cc0 and slength<=len(signature)
 blobs={}
 for i in range(n):
  slot,start=struct.unpack_from('>II',signature,12+i*8)
  length=struct.unpack_from('>I',signature,start+4)[0];blobs[slot]=signature[start:start+length]
 for slot,cd in blobs.items():
  if slot!=0 and not 0x1000<=slot<=0x1005:continue
  _,_,version,flags,hashoffset,_,special,ncode,limit=struct.unpack_from('>9I',cd,0)
  hsize,htype,_,psize=struct.unpack_from('>4B',cd,36)
  algorithm={1:'sha1',2:'sha256',3:'sha256',4:'sha384'}[htype]
  page_size=2**psize if psize else limit
  assert flags&2,('Expected ad-hoc signature',path)
  for i in range(ncode):
   digest=hashlib.new(algorithm,data[i*page_size:min((i+1)*page_size,limit)]).digest()[:hsize]
   assert digest==cd[hashoffset+i*hsize:hashoffset+(i+1)*hsize],('Code page hash mismatch',path,i)
   pages+=1
  for s in range(1,special+1):
   expected=cd[hashoffset-s*hsize:hashoffset-(s-1)*hsize]
   if not any(expected):continue
   if s in blobs:
    actual=hashlib.new(algorithm,blobs[s]).digest()[:hsize]
    assert expected==actual,('Special blob hash mismatch',path,s)
   elif s in [1,3]:
    candidates=[]
    for parent in path.parents:
     if parent==bundle.parent:break
     if s==1:candidates.extend([parent/'Info.plist',parent/'Resources/Info.plist'])
     else:candidates.append(parent/'_CodeSignature/CodeResources')
    assert any(p.is_file() and hashlib.new(algorithm,p.read_bytes()).digest()[:hsize]==expected for p in candidates),('Bundle hash mismatch',path,s)
  if slot==0:
   bundle_hashes[path.resolve()]=hashlib.new(algorithm,cd).digest()[:20]
   for parent in path.parents:
    if parent==bundle.parent:break
    if parent.suffix in ['.app','.framework']:

     plist_path = parent/'Contents/Info.plist' if parent.suffix=='.app' else parent/'Resources/Info.plist'
     if plist_path.is_file() and plistlib.loads(plist_path.read_bytes()).get('CFBundleExecutable')==path.name:
      bundle_hashes[parent.resolve()]=hashlib.new(algorithm,cd).digest()[:20]
     break
 count+=1

for p in bundle.rglob('*'):
 if p.is_file() and not p.is_symlink():
  with p.open('rb') as f:magic=f.read(4)
  if magic in [b'\xcf\xfa\xed\xfe',b'\xca\xfe\xba\xbe']:check_macho(p,p.read_bytes())
for p in bundle.rglob('CodeResources'):
 root=p.parent.parent
 for rel,entry in plistlib.loads(p.read_bytes()).get('files2',{}).items():
  target=root/rel
  if isinstance(entry,bytes):entry={'hash':entry}
  if 'symlink' in entry:assert target.is_symlink() and str(target.readlink())==entry['symlink']
  for k,algorithm in [('hash','sha1'),('hash2','sha256')]:
   if k in entry:
    assert hashlib.new(algorithm,target.read_bytes()).digest()==entry[k],('Resource mismatch',target)
    resources+=1
  if 'cdhash' in entry:assert bundle_hashes[target.resolve()]==entry['cdhash'],('Nested code mismatch',target)
assert count>10
print(f'PASS independent ad-hoc signature verification: {count} Mach-O binaries, {pages} code page hashes, {resources} resource hashes, nested code references and Info.plist hashes.')
