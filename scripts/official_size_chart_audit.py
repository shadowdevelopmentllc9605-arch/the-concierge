#!/usr/bin/env python3
import argparse, html, json, os, re, sys, time
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UA = "Mozilla/5.0 (compatible; ConciergeSizingAudit/1.0; +https://shadowdevelopmentl.wixsite.com/the-concierge)"
BLOCKED = {
    "amazon.com","ebay.com","walmart.com","target.com","macys.com","nordstrom.com",
    "nordstromrack.com","bloomingdales.com","dillards.com","jcpenney.com","kohls.com",
    "belk.com","beallsflorida.com","boscovs.com","saksfifthavenue.com","neimanmarcus.com",
    "bergdorfgoodman.com","vonmaur.com","pinterest.com","facebook.com","instagram.com",
    "tiktok.com","youtube.com","wikipedia.org","reddit.com"
}
TRUSTED_RETAILERS = {
    "walmart.com","target.com","macys.com","nordstrom.com","nordstromrack.com",
    "bloomingdales.com","dillards.com","jcpenney.com","kohls.com","belk.com",
    "beallsflorida.com","boscovs.com","saksfifthavenue.com","neimanmarcus.com",
    "bergdorfgoodman.com","vonmaur.com","digitalcontent.target.com"
}
MEASURE_KEYS = {
    "chest":("chest_min_cm","chest_max_cm"),
    "bust":("bust_min_cm","bust_max_cm"),
    "waist":("waist_min_cm","waist_max_cm"),
    "hip":("hips_min_cm","hips_max_cm"),
    "hips":("hips_min_cm","hips_max_cm"),
    "seat":("hips_min_cm","hips_max_cm"),
    "inseam":("inseam_min_cm","inseam_max_cm"),
    "neck":("neck_min_cm","neck_max_cm"),
    "sleeve":("sleeve_min_cm","sleeve_max_cm"),
    "height":("height_min_cm","height_max_cm"),
    "head circumference":("head_circumference_min_cm","head_circumference_max_cm"),
    "head":("head_circumference_min_cm","head_circumference_max_cm"),
    "foot length":("foot_length_min_cm","foot_length_max_cm"),
    "length":("foot_length_min_cm","foot_length_max_cm"),
}
SIZE_WORDS = {"size","sizes","us","us/ca","us size","numeric","numeric size","alpha size"}
RETAILER_KEY_TO_DOMAIN = {
    "walmart":"walmart.com","target":"target.com","macys":"macys.com","nordstrom":"nordstrom.com",
    "nordstromrack":"nordstromrack.com","bloomingdales":"bloomingdales.com","dillards":"dillards.com",
    "jcpenney":"jcpenney.com","kohls":"kohls.com","belk":"belk.com","beallsflorida":"beallsflorida.com",
    "boscovs":"boscovs.com","saksfifthavenue":"saksfifthavenue.com","neimanmarcus":"neimanmarcus.com",
    "bergdorfgoodman":"bergdorfgoodman.com","vonmaur":"vonmaur.com"
}

def norm(s):
    return re.sub(r"[^a-z0-9]+","", (s or "").lower())

def domain_of(url):
    d=urlparse(url).netloc.lower().split(":")[0]
    return d[4:] if d.startswith("www.") else d

def significant_tokens(name):
    stop={"and","the","by","of","for","co","company","brand","brands","inc","llc"}
    return [norm(x) for x in re.split(r"[\s&+/.'’-]+", name.lower()) if norm(x) and norm(x) not in stop and len(norm(x))>=3]

def brand_domain_match(name, domain):
    dn=norm(domain.split(".")[0])
    full=norm(name)
    if len(full)>=4 and (full in norm(domain) or dn in full):
        return True
    toks=significant_tokens(name)
    return any(len(t)>=4 and (t in dn or dn in t) for t in toks)

def fetch(url, timeout=16, max_bytes=2_500_000):
    req=Request(url,headers={"User-Agent":UA,"Accept-Language":"en-US,en;q=0.9"})
    with urlopen(req,timeout=timeout) as r:
        data=r.read(max_bytes+1)
        if len(data)>max_bytes:
            data=data[:max_bytes]
        enc=r.headers.get_content_charset() or "utf-8"
        return data.decode(enc,"ignore"), r.geturl(), r.headers.get("Content-Type","")

class SearchParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.in_result=False; self.href=None; self.buf=[]
    def handle_starttag(self,tag,attrs):
        if tag!="a": return
        a=dict(attrs); cls=a.get("class","")
        if "result__a" in cls:
            self.in_result=True; self.href=a.get("href"); self.buf=[]
    def handle_data(self,data):
        if self.in_result: self.buf.append(data)
    def handle_endtag(self,tag):
        if tag=="a" and self.in_result:
            self.links.append((html.unescape(" ".join(self.buf)).strip(),self.href or ""))
            self.in_result=False; self.href=None; self.buf=[]

def decode_ddg_url(href):
    href=html.unescape(href or "")
    if href.startswith("//"): href="https:"+href
    if "duckduckgo.com/l/" in href:
        q=parse_qs(urlparse(href).query)
        if q.get("uddg"): return unquote(q["uddg"][0])
    return href

def search_ddg(query):
    url="https://html.duckduckgo.com/html/?q="+quote_plus(query)
    body,_,_=fetch(url,timeout=18,max_bytes=900_000)
    p=SearchParser(); p.feed(body)
    out=[]
    for title,href in p.links:
        u=decode_ddg_url(href)
        if u.startswith("http") and u not in [x[1] for x in out]:
            out.append((title,u))
    return out

class GenericLinkParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.href=None; self.buf=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":
            self.href=dict(attrs).get("href"); self.buf=[]
    def handle_data(self,data):
        if self.href is not None: self.buf.append(data)
    def handle_endtag(self,tag):
        if tag=="a" and self.href is not None:
            self.links.append((re.sub(r"\s+"," "," ".join(self.buf)).strip(),html.unescape(self.href)))
            self.href=None; self.buf=[]

def search_bing(query):
    url="https://www.bing.com/search?q="+quote_plus(query)
    body,_,_=fetch(url,timeout=18,max_bytes=1_600_000)
    p=GenericLinkParser(); p.feed(body)
    out=[]; seen=set()
    nav={"web","images","videos","maps","news","flights","shopping","privacy and cookies",
         "legal","advertise","about our ads","help","consumer health privacy","learn more"}
    for title,href in p.links:
        clean=re.sub(r"\s+"," ",title or "").strip()
        if clean.lower() in nav or not clean: continue
        if href.startswith("https://www.bing.com/ck/") and href not in seen:
            seen.add(href); out.append((clean,href))
    return out

def discover_size_links(raw,base_url):
    p=GenericLinkParser()
    try: p.feed(raw)
    except Exception: return []
    base_domain=domain_of(base_url)
    out=[]; seen=set()
    for title,href in p.links:
        u=urljoin(base_url,href or "")
        if not u.startswith("http") or domain_of(u)!=base_domain: continue
        hay=(title+" "+u).lower()
        if not any(k in hay for k in ("size guide","size-guide","size chart","size-chart","sizing","fit guide","fit-guide")):
            continue
        u=u.split("#")[0]
        if u in seen: continue
        seen.add(u); out.append((title or "size guide",u))
    return out[:12]

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.stack=[]; self.cur_table=None; self.cur_row=None; self.cur_cell=None
        self.last_heading=""; self.heading_tag=None; self.heading_buf=[]; self.title=""; self.in_title=False
    def handle_starttag(self,tag,attrs):
        self.stack.append(tag)
        if tag=="title": self.in_title=True
        if tag in ("h1","h2","h3","h4","h5","h6"):
            self.heading_tag=tag; self.heading_buf=[]
        if tag=="table":
            self.cur_table={"heading":self.last_heading,"rows":[]}; self.tables.append(self.cur_table)
        elif tag=="tr" and self.cur_table is not None:
            self.cur_row=[]; self.cur_table["rows"].append(self.cur_row)
        elif tag in ("th","td") and self.cur_row is not None:
            self.cur_cell=[]; self.cur_row.append(self.cur_cell)
    def handle_data(self,data):
        if self.in_title: self.title+=data
        if self.heading_tag: self.heading_buf.append(data)
        if self.cur_cell is not None: self.cur_cell.append(data)
    def handle_endtag(self,tag):
        if tag=="title": self.in_title=False
        if tag==self.heading_tag:
            self.last_heading=" ".join(self.heading_buf).strip(); self.heading_tag=None; self.heading_buf=[]
        if tag in ("th","td") and self.cur_cell is not None:
            txt=re.sub(r"\s+"," "," ".join(self.cur_cell)).strip()
            self.cur_row[-1]=txt; self.cur_cell=None
        elif tag=="tr": self.cur_row=None
        elif tag=="table": self.cur_table=None
        if self.stack: self.stack.pop()

def strip_text(raw):
    x=re.sub(r"(?is)<script.*?</script>|<style.*?</style>|<noscript.*?</noscript>"," ",raw)
    x=re.sub(r"(?s)<[^>]+>"," ",x)
    return re.sub(r"\s+"," ",html.unescape(x)).strip()

def inch_factor(text):
    t=text.lower()
    if re.search(r"\b(cm|centimeters?|centimetres?)\b",t): return 1.0
    if re.search(r"\b(mm|millimeters?|millimetres?)\b",t): return 0.1
    if re.search(r"\b(inches|inch|in\.)\b",t) or '"' in text: return 2.54
    return None

def numrange(s):
    s=(s or "").strip().replace("½",".5").replace("¼",".25").replace("¾",".75")
    s=re.sub(r"(?<=\d),(?=\d)","",s)
    vals=re.findall(r"(?<![A-Za-z])(\d+(?:\.\d+)?)",s)
    if not vals: return None
    vals=[float(v) for v in vals]
    return (vals[0], vals[-1])

def clean_header(s):
    s=re.sub(r"\([^)]*\)","",s.lower())
    s=s.replace("natural ","").replace("low ","")
    s=re.sub(r"\s+"," ",s).strip()
    return s

def audience_from(text):
    t=text.lower()
    if any(x in t for x in ["women","woman","womens","ladies","female"]): return "women"
    if any(x in t for x in ["men","mens","man","male"]): return "men"
    if any(x in t for x in ["baby","infant","toddler","little kid","big kid","youth","boy","girl","child","kids","kid's"]): return "kids"
    if "unisex" in t: return "unisex"
    return "unknown"

def age_from(text,audience):
    t=text.lower()
    if "infant" in t or "baby" in t: return "infant"
    if "toddler" in t or "little kid" in t: return "toddler"
    if "youth" in t or "big kid" in t or "teen" in t: return "youth"
    if audience=="kids": return "kids"
    if audience in ("men","women","unisex"): return "adult"
    return "unknown"

def gender_detail(text,audience):
    t=text.lower()
    if "boy" in t: return "boys"
    if "girl" in t: return "girls"
    if "unisex" in t: return "unisex"
    return "not_applicable" if audience!="kids" else "unknown"

def category_from(text):
    t=text.lower()
    if any(x in t for x in ["shoe","footwear","boot","sneaker","sandal","heel","loafer","oxford"]): return "footwear"
    if any(x in t for x in ["swim","bikini","swimsuit"]): return "swimwear"
    if any(x in t for x in ["bra","panty","panties","underwear","lingerie","brief","boxer","cami","slip"]): return "underwear"
    if any(x in t for x in ["coat","outerwear","jacket","blazer"]): return "outerwear"
    if any(x in t for x in ["pants","bottom","jean","denim","shorts","skirt"]): return "bottoms"
    if any(x in t for x in ["dress","gown"]): return "dresses"
    if any(x in t for x in ["suit","tux"]): return "suits"
    if any(x in t for x in ["hat","headwear","cap"]): return "headwear"
    if any(x in t for x in ["shirt","top","polo","tee","sweater","hoodie"]): return "tops"
    return "other"

def canonical_measure(header):
    h=clean_header(header)
    for k,v in MEASURE_KEYS.items():
        if k in h: return v
    return None

def looks_size_header(h):
    h=clean_header(h)
    return h in SIZE_WORDS or h.startswith("size ") or h=="size"

def normalize_row_table(rows, context):
    rows=[[c.strip() for c in row if c is not None] for row in rows if row and any(c.strip() for c in row if c is not None)]
    if len(rows)<3: return []
    header=rows[0]
    # Handle vertical tables: first column measurements, sizes across first row.
    firstcol=[clean_header(r[0]) if r else "" for r in rows[1:]]
    if not any(looks_size_header(h) for h in header) and any(canonical_measure(x) for x in firstcol):
        sizes=header[1:]
        trans=[["size"]+[r[0] for r in rows[1:]]]
        for i,s in enumerate(sizes,1):
            trans.append([s]+[(r[i] if i<len(r) else "") for r in rows[1:]])
        rows=trans; header=rows[0]
    hs=[clean_header(x) for x in header]
    size_idx=None
    for i,h in enumerate(hs):
        if looks_size_header(h): size_idx=i; break
    # footwear table sometimes has Length | US | EU | UK; use US as size
    if size_idx is None:
        for i,h in enumerate(hs):
            if h in ("us","us/ca","us size"): size_idx=i; break
    if size_idx is None: return []
    mapping={}
    for i,h in enumerate(hs):
        m=canonical_measure(h)
        if m: mapping[i]=m
    foot_length_idx=None
    for i,h in enumerate(hs):
        if "length" in h and ("cm" in header[i].lower() or category_from(context)=="footwear"):
            foot_length_idx=i; mapping[i]=("foot_length_min_cm","foot_length_max_cm")
    if not mapping: return []
    local_factor=inch_factor(" ".join(header)+" "+context)
    if category_from(context)=="footwear" and foot_length_idx is not None and "cm" in " ".join(header).lower():
        local_factor=1.0
    if local_factor is None:
        # Conservative: if no unit marker, do not turn measurements into body dimensions.
        return []
    entries=[]
    last_alpha=""
    for row in rows[1:]:
        if len(row)<=size_idx: continue
        size=row[size_idx].strip()
        if not size and last_alpha: size=last_alpha
        if not size: continue
        e={"size":size}
        meaningful=0
        for i,(lo_key,hi_key) in mapping.items():
            if i>=len(row): continue
            nr=numrange(row[i])
            if not nr: continue
            lo,hi=nr
            factor=local_factor
            # width tables may be mm while main context is cm/inches; only foot length handled here.
            e[lo_key]=round(lo*factor,2); e[hi_key]=round(hi*factor,2); meaningful+=1
        for i,h in enumerate(hs):
            if i>=len(row): continue
            if h in ("eu","eu size"): e["eu_size"]=row[i]
            if h in ("uk","uk size"): e["uk_size"]=row[i]
            if h in ("us","us/ca","us size") and i!=size_idx: e["us_size"]=row[i]
            if "numeric" in h: e["numeric_equivalent"]=row[i]
        if meaningful:
            entries.append(e)
            if re.fullmatch(r"[A-Za-z0-9Xx+\-]+",size): last_alpha=size
    return entries

def extract_charts(raw,url,brand):
    p=TableParser()
    try: p.feed(raw)
    except Exception: pass
    page_text=strip_text(raw)[:180000]
    page_title=re.sub(r"\s+"," ",p.title).strip()
    charts=[]
    for idx,t in enumerate(p.tables):
        rows=t.get("rows") or []
        heading=t.get("heading") or ""
        context=" ".join([heading,page_title,url])
        entries=normalize_row_table(rows,context)
        if len(entries)<3: continue
        aud=audience_from(context+" "+page_text[:5000])
        cat=category_from(context)
        age=age_from(context,aud)
        chart={
            "brand_name":brand["brand_name"],"brand_key":brand["brand_key"],"region":"US",
            "audience":aud,"age_group":age,"gender_detail":gender_detail(context,aud),
            "category_group":cat,"chart_name":(heading or page_title or "Official size chart")[:180],
            "fit_type":"standard","measurement_basis":"body","source_url":url,
            "source_type":"official_brand","active":True,"version":"2026-10-06-html-source-pass",
            "notes":"Extracted conservatively from official HTML table; no inferred measurements.",
            "entries":entries
        }
        charts.append(chart)
    return charts, page_title, page_text

def retailer_domains_for(brand):
    out=set()
    for rp in brand.get("retailer_presence") or []:
        d=domain_of(rp.get("source_url") or "")
        if d: out.add(d)
        rk=(rp.get("retailer_key") or "").lower()
        if rk in RETAILER_KEY_TO_DOMAIN: out.add(RETAILER_KEY_TO_DOMAIN[rk])
    return out

def candidate_ok(brand,url):
    d=domain_of(url)
    if not d: return False, None
    private=brand.get("brand_type") in ("retailer_private_label","retailer_exclusive")
    rd=retailer_domains_for(brand)
    is_retailer=any(d==x or d.endswith("."+x) for x in TRUSTED_RETAILERS)
    if is_retailer:
        retailer_match=any(d==x or d.endswith("."+x) or x.endswith("."+d) for x in rd)
        if retailer_match and (private or d=="digitalcontent.target.com"):
            return True,"verified_partner"
        return False,None
    if any(d==x or d.endswith("."+x) for x in BLOCKED): return False,None
    if brand_domain_match(brand["brand_name"],d): return True,"official_brand"
    return False,None

def score_candidate(brand,title,url,raw,charts):
    d=domain_of(url); s=0
    if brand_domain_match(brand["brand_name"],d): s+=4
    brand_token=norm(brand["brand_name"])
    if len(brand_token)>=4 and brand_token in norm(title+" "+url+" "+strip_text(raw)[:8000]): s+=4
    t=(title+" "+url).lower()
    if any(x in t for x in ["size-chart","sizechart","size-guide","sizeguide","sizing","fit-guide","fitguide"]): s+=3
    page=strip_text(raw)[:50000].lower()
    if "size chart" in page or "size guide" in page or "sizing" in page: s+=2
    if charts: s+=5+min(3,len(charts))
    return s

def audit_brand(brand,sleep_s=0.35):
    q=f'"{brand["brand_name"]}" size chart size guide'
    result={"brand_name":brand["brand_name"],"brand_key":brand["brand_key"],"old_status":brand.get("sizing_status"),"query":q,"checked":[],"promotions":[]}
    try:
        links=search_bing(q)
        if not links:
            links=search_ddg(q)
    except Exception as e:
        try:
            links=search_ddg(q)
        except Exception as e2:
            result["error"]="search: "+repr(e)+" / "+repr(e2); return result
    for title,url in links[:24]:
        try:
            raw,final_url,ctype=fetch(url)
            ok,stype=candidate_ok(brand,final_url)
            if not ok: continue
            candidates=[(title,final_url,raw,ctype)]
            for ititle,iu in discover_size_links(raw,final_url):
                try:
                    iraw,ifinal,ictype=fetch(iu)
                    candidates.append((ititle,ifinal,iraw,ictype))
                except Exception:
                    pass
            for ctitle,curl,craw,cctype in candidates:
                ok2,stype2=candidate_ok(brand,curl)
                if not ok2: continue
                charts,ptitle,ptext=extract_charts(craw,curl,brand)
                for c in charts: c["source_type"]=stype2
                sc=score_candidate(brand,ctitle,curl,craw,charts)
                result["checked"].append({"title":ctitle,"url":curl,"domain":domain_of(curl),"score":sc,"chart_count":len(charts),"content_type":cctype})
                if sc>=13 and charts:
                    for c in charts:
                        if c["audience"]!="unknown":
                            result["promotions"].append(c)
                    if result["promotions"]:
                        break
            if result["promotions"]:
                break
        except (HTTPError,URLError,TimeoutError,ValueError) as e:
            result["checked"].append({"title":title,"url":url,"error":repr(e)})
        except Exception as e:
            result["checked"].append({"title":title,"url":url,"error":repr(e)})
        time.sleep(sleep_s)
    return result

def load_brands(path,statuses):
    d=json.load(open(path,encoding="utf-8"))
    rows=d["brands"] if isinstance(d,dict) else d
    return [r for r in rows if r.get("active",True) and r.get("sizing_status") in statuses]

def chart_sig(c):
    return "|".join([c.get("brand_key",""),c.get("audience",""),c.get("age_group",""),c.get("category_group",""),c.get("chart_name",""),c.get("source_url","")])

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",default="data/brand-catalog.json")
    ap.add_argument("--status",default="partial,estimate_only")
    ap.add_argument("--offset",type=int,default=0)
    ap.add_argument("--limit",type=int,default=25)
    ap.add_argument("--brand-key",action="append",default=[])
    ap.add_argument("--output",default="data/html-sizing-audit-results.json")
    ap.add_argument("--sleep",type=float,default=0.35)
    args=ap.parse_args()
    statuses=set(x.strip() for x in args.status.split(",") if x.strip())
    brands=load_brands(args.input,statuses)
    if args.brand_key:
        wanted=set(args.brand_key); brands=[b for b in brands if b.get("brand_key") in wanted]
    else:
        brands=brands[args.offset:args.offset+args.limit]
    existing={"version":"2026-10-06-html-source-pass","results":[],"promotions":[]}
    if os.path.exists(args.output):
        try: existing=json.load(open(args.output,encoding="utf-8"))
        except Exception: pass
    done={r.get("brand_key") for r in existing.get("results",[])}
    results=list(existing.get("results",[])); promotions=list(existing.get("promotions",[]))
    sigs={chart_sig(c) for c in promotions}
    for i,b in enumerate(brands,1):
        if b.get("brand_key") in done: continue
        print(f"[{i}/{len(brands)}] {b.get('brand_name')} ({b.get('brand_key')})",flush=True)
        r=audit_brand(b,args.sleep); results.append(r)
        for c in r.get("promotions",[]):
            s=chart_sig(c)
            if s not in sigs: promotions.append(c); sigs.add(s)
        with open(args.output,"w",encoding="utf-8") as f:
            json.dump({"version":"2026-10-06-html-source-pass","results":results,"promotions":promotions},f,indent=2)
        time.sleep(args.sleep)
    print(json.dumps({
        "audited_total":len(results),
        "promotion_chart_count":len(promotions),
        "promotion_brand_count":len({c.get("brand_key") for c in promotions}),
        "output":args.output
    },indent=2))

if __name__=="__main__":
    main()
