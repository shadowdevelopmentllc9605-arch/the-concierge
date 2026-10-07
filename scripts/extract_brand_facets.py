#!/usr/bin/env python3
import argparse, json, re, urllib.request

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "ignore")

def extract_brand_facet(raw):
    # Next.js RSC payloads escape JSON quotes as \" inside script text.
    marker = '\\\"display_name\\\":\\\"Brand\\\",\\\"name\\\":\\\"brand\\\"'
    pos = raw.find(marker)
    if pos < 0:
        return []
    segment = raw[pos:pos + 500000]
    end = segment.find('],\\\"hidden\\\":')
    if end > 0:
        segment = segment[:end]
    values = re.findall(r'\\\"display_name\\\":\\\"([^"]+?)\\\"', segment)
    if values and values[0].lower() == "brand":
        values = values[1:]
    cleaned = []
    seen = set()
    for value in values:
        value = value.replace("\\u0026", "&").replace("\\u0027", "'").replace("\\u0026", "&")
        value = value.replace("\\u2019", "’").replace("\\u00ae", "®").replace("\\u2122", "™")
        if value and value not in seen:
            seen.add(value)
            cleaned.append(value)
    return cleaned

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="+")
    args = parser.parse_args()
    out = {}
    for url in args.url:
        raw = fetch(url)
        out[url] = extract_brand_facet(raw)
    print(json.dumps(out, ensure_ascii=False))

if __name__ == "__main__":
    main()
