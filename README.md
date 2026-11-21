# HEIC2JPG

A browser-based HEIC, HEIF and image converter that produces JPG/JPEG files. Select images or folders, adjust JPEG quality, and download individual images or a ZIP archive. Image conversion runs locally in the browser.

## Run locally

Serve this directory with a static web server, for example `python -m http.server 8000`, then open `http://localhost:8000`.

The project uses plain HTML, CSS and JavaScript. Bootstrap, Bootstrap Icons, heic2any, JSZip and FileSaver are loaded from jsDelivr, so an internet connection is needed to load those dependencies. No package installation or build step is required.

## SEO metadata

`index.html` contains the page description, developer metadata, Open Graph and Twitter card metadata, and one WebSite JSON-LD block identifying the genuine creator. The existing page title and HEIC2JPG branding are preserved.

The official public site URL has not been supplied. Once verified, add a canonical link, `og:url`, and the WebSite `url` using HEIC2JPG's own public URL. The developer website must not be used as the converter's canonical URL. No social preview image is configured because no suitable image asset is present.

The visible footer credit uses `rel="noopener noreferrer nofollow"` for the promotional developer link. Structured data describes the creator; it does not guarantee search rich results.

## Development

Developed by [TheBenzzCreations](https://www.thebenzzcreations.com/).

TheBenzzCreations builds custom websites, mobile applications, business software, e-commerce platforms and AI automation solutions.

For development enquiries, visit our official website.
