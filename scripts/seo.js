/* Link previews and structured data for the hosted site (the gap review's step 4, 8.10.2026): what a shared
   link shows, and what Google and the AI assistants read about the site. Nothing here is new wording: every
   text comes from the page itself (its <title>, its meta description, its questions and answers), so the two
   cannot drift apart. scripts/build-hosted.js runs it over dist/ after cleanLinks; tests/hosted_t.js checks it.

   - Each page with a canonical address gets Open Graph and Twitter card tags: its title, its description,
     its address, and the preview image (og.png, scripts/build-og.js).
   - The home page gets one JSON-LD graph: the organisation, the site, the web application (free, in Hebrew,
     runs in the browser) and its FAQ (the home page's <details>).
   - The help page gets its 17 questions and answers as an FAQ. */
const ORIGIN = "https://inkognito.co.il";

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
// text of a piece of HTML: no tags, no comments, one space between words, a line between blocks (a heading
// inside an answer, «ב־ChatGPT», ran into the sentence after it)
const text = (html) => decode(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/(p|h[1-6]|li|div)>|<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, ""))
  .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function head(html) {
  const canonical = (/<link rel="canonical" href="([^"]+)">/.exec(html) || [])[1];
  const title = text((/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || "");
  const description = decode((/<meta name="description" content="([^"]*)">/.exec(html) || [])[1] || "");
  return { canonical, title, description };
}

// the home page's FAQ: each <details> is a question (its <summary>) and its answer (the rest)
function homeFaq(html) {
  return [...html.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map((m) => ({ q: text(m[1]), a: text(m[2]) })).filter((x) => x.q && x.a);
}
// the help page: each <h2 id="qNN"> is a question, and what follows it up to the next heading its answer
function helpFaq(html) {
  return [...html.matchAll(/<h2 id="q\d+">([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[\s>]|<\/main>|<\/section>|<footer)/g)]
    .map((m) => ({ q: text(m[1]), a: text(m[2]) })).filter((x) => x.q && x.a);
}
const faqPage = (url, items) => ({ "@type": "FAQPage", "@id": url + "#faq", url, inLanguage: "he",
  mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });

function previewTags({ canonical, title, description }) {
  const t = [
    ["property", "og:type", "website"], ["property", "og:site_name", "אינקוגניטו"], ["property", "og:locale", "he_IL"],
    ["property", "og:title", title], ["property", "og:description", description], ["property", "og:url", canonical],
    ["property", "og:image", ORIGIN + "/og.png"], ["property", "og:image:width", "1200"], ["property", "og:image:height", "630"],
    ["property", "og:image:alt", "אינקוגניטו: החלפת שמות במסמכים לפני AI"],
    ["name", "twitter:card", "summary_large_image"], ["name", "twitter:title", title], ["name", "twitter:description", description],
    ["name", "twitter:image", ORIGIN + "/og.png"],
  ];
  return t.map(([k, n, v]) => `<meta ${k}="${n}" content="${attr(v)}">`).join("\n");
}

const ld = (graph) => '<script type="application/ld+json">' + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") + "</script>";

// one page's HTML, with its tags and data added; a page with no canonical address is left as it is
function seo(name, html) {
  const h = head(html);
  if (!h.canonical || !h.title || !h.description) return html;
  let add = previewTags(h);
  if (name === "index.html") {
    const org = { "@type": "Organization", "@id": ORIGIN + "/#org", name: "אינקוגניטו", alternateName: "InKognito", url: ORIGIN + "/",
      logo: ORIGIN + "/icon-192.png", email: "contact@inkognito.co.il" };
    const site = { "@type": "WebSite", "@id": ORIGIN + "/#site", name: "אינקוגניטו", url: ORIGIN + "/", inLanguage: "he", publisher: { "@id": ORIGIN + "/#org" } };
    const app = { "@type": "WebApplication", "@id": ORIGIN + "/#app", name: "אינקוגניטו", url: ORIGIN + "/", description: h.description,
      applicationCategory: "BusinessApplication", operatingSystem: "דפדפן", browserRequirements: "דפדפן עדכני", inLanguage: "he",
      isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "ILS" }, publisher: { "@id": ORIGIN + "/#org" } };
    const faq = homeFaq(html);
    add += "\n" + ld([org, site, app, ...(faq.length ? [faqPage(h.canonical, faq)] : [])]);
  } else if (name === "help.html") {
    const faq = helpFaq(html);
    if (faq.length) add += "\n" + ld([faqPage(h.canonical, faq)]);
  }
  return html.replace(/(<link rel="canonical" href="[^"]+">)/, (m) => m + "\n" + add);
}

module.exports = { seo, homeFaq, helpFaq, head, text };
