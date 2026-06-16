import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_fetched": 0,
    "expiry_seconds": 3600  # 1 hour
}

def parse_xml_feed(xml_content):
    """
    Parses the Atom XML feed into a structured list of entries.
    """
    root = ET.fromstring(xml_content)
    
    # Atom namespace
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
    
    entries = []
    for entry in root.findall(f"{ns}entry"):
        title_elem = entry.find(f"{ns}title")
        id_elem = entry.find(f"{ns}id")
        updated_elem = entry.find(f"{ns}updated")
        content_elem = entry.find(f"{ns}content")
        
        # Link alternate
        link_elem = None
        for l in entry.findall(f"{ns}link"):
            if l.attrib.get('rel') == 'alternate' or not l.attrib.get('rel'):
                link_elem = l
                break
        
        title = title_elem.text if title_elem is not None else "Unknown Date"
        entry_id = id_elem.text if id_elem is not None else ""
        updated = updated_elem.text if updated_elem is not None else ""
        link = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        raw_html = content_elem.text if content_elem is not None else ""
        
        entries.append({
            "id": entry_id,
            "title": title,
            "updated": updated,
            "link": link,
            "raw_html": raw_html
        })
        
    return entries

def fetch_feed(force_refresh=False):
    """
    Fetches feed from URL, uses cache if valid and force_refresh is False.
    """
    now = time.time()
    if not force_refresh and cache["data"] is not None and (now - cache["last_fetched"]) < cache["expiry_seconds"]:
        return cache["data"], "cache_hit"
    
    try:
        response = requests.get(FEED_URL, headers={'User-Agent': 'BigQueryReleaseNotesApp/1.0'}, timeout=15)
        response.raise_for_status()
        
        parsed_entries = parse_xml_feed(response.content)
        
        # Update cache
        cache["data"] = parsed_entries
        cache["last_fetched"] = now
        return parsed_entries, "cache_miss"
    except Exception as e:
        # If fetch fails, return cached data if available
        if cache["data"] is not None:
            return cache["data"], f"error_fallback: {str(e)}"
        raise e

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    force = request.args.get("force", "false").lower() == "true"
    try:
        entries, status = fetch_feed(force_refresh=force)
        return jsonify({
            "success": True,
            "status": status,
            "last_fetched": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cache["last_fetched"])),
            "entries": entries
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
