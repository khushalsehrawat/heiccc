# HEIC2JPG

A browser-based HEIC, HEIF and image converter that produces JPG/JPEG files. Select images or folders, adjust JPEG quality, and download individual images or a ZIP archive. Image conversion runs locally in the browser.

## Run locally

Serve this directory with a static web server, for example `python -m http.server 8000`, then open `http://localhost:8000`.

The project uses plain HTML, CSS and JavaScript. Bootstrap, Bootstrap Icons, heic2any, JSZip and FileSaver are loaded from jsDelivr, so an internet connection is needed to load those dependencies. No package installation or build step is required.

## SEO metadata

`index.html` contains the page description, developer metadata, Open Graph and Twitter card metadata, and one WebSite JSON-LD block identifying the genuine creator. The existing page title and HEIC2JPG branding are preserved.

Production identity is recorded in `seo-sites.json`; see Canonical URL validation below. The developer credit is not evidence of a project deployment URL.

The visible footer credit uses a normal same-tab hyperlink for the developer link. Structured data describes the creator; it does not guarantee search rich results.

## Development & Maintenance

**Developed & Maintained by
[Khushal Sehrawat](https://github.com/khushalsehrawat)**
— Founder of
[TheBenzzCreations](https://www.thebenzzcreations.com/).

TheBenzzCreations is a digital development studio specializing in website development, custom software, mobile applications, e-commerce solutions and AI-powered business automation.

For development enquiries and collaborations, visit [TheBenzzCreations](https://www.thebenzzcreations.com/).

## Canonical URL validation

Run `python scripts/validate_seo.py` from this repository before publishing. The dependency-free check validates exact page canonicals, Open Graph URLs, website/application JSON-LD URLs, sitemap locations, robots sitemap references and literal framework site metadata against `seo-sites.json`. It checks deployment path prefixes as well as domains, so one GitHub Pages project cannot canonicalize to another.

Only URLs whose live HTML matched the local page on 2026-11-21 are configured. Unverified pages have no canonical or social URL; `python scripts/validate_seo.py --require-verified` also fails for those pending pages. Reverify the configuration if the deployment moves. Dynamic framework expressions still require runtime validation.

TheBenzzCreations attribution, creator organization URLs and existing normal same-tab developer credit links are preserved. These outbound attribution links are separate from site identity.
