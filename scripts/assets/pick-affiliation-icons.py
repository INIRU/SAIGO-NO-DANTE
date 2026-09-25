# -*- coding: utf-8 -*-
import json, os, re, unicodedata
from collections import Counter, defaultdict
D='/Users/iniru/Downloads/LimbusAssets/Images/키워드'
files=[unicodedata.normalize('NFC',f) for f in os.listdir(D) if f.endswith('.png')]
# keyword name -> file (skip morale/panic)
kw={}
for f in files:
    if re.search('LowMorale|Panic', f): continue
    m=re.match(r'([^_]+(?:_[A-Za-z0-9]+)*)_(.+)\.png$', f)
    if not m: continue
    name=m.group(2).strip()
    if len(name)<2 or re.fullmatch(r'[A-Za-z0-9_ ]+', name): continue
    kw.setdefault(name, f)
d=json.load(open('/tmp/lb-aff-data.json'))
GENERIC={'LCB','림버스 컴퍼니'}
text=defaultdict(str)
for row in d['passives']+d['skills']: text[row['identity_id']]+=' '+(row['description'] or '')
aff=defaultdict(list)
for i in d['identities']:
    for a in set((x.split(' - ')[0].strip()) for x in (i['association_list'] or [])):
        if a not in GENERIC: aff[a].append(i['id'])
# base keywords to skip
BASE=set('화상 출혈 진동 파열 침잠 호흡 충전 참격 관통 타격 신속 속박 공격 위력 증가 감소 보호 취약 마비 방어 레벨 피해량 합 위력 인내 집중 정신력 탄환 충전 역장 과부하'.split())
idcount=Counter()
per=defaultdict(Counter)
names=sorted(kw, key=len, reverse=True)
for iid,t in text.items():
    found=set(n for n in names if n not in BASE and ('['+n+']' in t or n in t) and len(n)>=2)
    for n in found: idcount[n]+=1
for a,ids in aff.items():
    for iid in ids:
        t=text.get(iid,'')
        for n in names:
            if n in BASE or len(n)<2: continue
            if n in t: per[a][n]+=1
res={}
for a,ids in sorted(aff.items(), key=lambda x:-len(x[1])):
    scored=[(c/len(ids)*(c/max(idcount[n],1)), n, c, idcount[n]) for n,c in per[a].items() if c>=1]
    scored.sort(reverse=True)
    res[a]=[(n,kw[n],c,tot) for _,n,c,tot in scored[:4]]
json.dump(res, open('/tmp/lb-aff-cand.json','w'), ensure_ascii=False)
for a,c in res.items(): print(a, len(aff[a]), ' | '.join(f'{n}({c}/{t})' for n,_,c,t in c))

