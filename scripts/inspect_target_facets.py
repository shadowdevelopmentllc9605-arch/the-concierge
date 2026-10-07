#!/usr/bin/env python3
import json,re
from html import unescape
p='data/target-kids-current.html'
raw=open(p,encoding='utf-8').read()
m=re.search(r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>',raw,re.S)
if not m:
    print("NO_NEXT_DATA"); raise SystemExit
data=json.loads(unescape(m.group(1)))
hits=[]
def walk(x,path='root'):
    if isinstance(x,dict):
        vals=[str(v) for v in x.values() if isinstance(v,(str,int,float,bool))]
        keys=[str(k) for k in x.keys()]
        blob=' '.join(keys+vals).lower()
        if 'brand' in blob and any(t in blob for t in ('facet','refinement','filter','display_name','displayname','name')):
            slim={k:v for k,v in x.items() if isinstance(v,(str,int,float,bool,type(None)))}
            hits.append((path,slim))
        for k,v in x.items(): walk(v,path+'.'+str(k))
    elif isinstance(x,list):
        for i,v in enumerate(x): walk(v,path+f'[{i}]')
walk(data)
print("hits",len(hits))
for path,obj in hits[:120]:
    print(path, json.dumps(obj,ensure_ascii=False)[:1200])
