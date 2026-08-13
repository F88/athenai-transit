# Promo Materials

Source material for creating product introduction content (blog posts, presentations, etc.).

> [!IMPORTANT]
> **These are intermediate working documents for authoring materials — not finished documents to be used as-is.** They are also **not** product development requirements or specifications (INPUT). For requirements see [../PRD.md](../PRD.md); for developer documentation see [../DEVELOPMENT.md](../DEVELOPMENT.md).

CONCEPT.md and FEATURE_CATALOG.md are the two foundational sources — CONCEPT holds the _why_ (the concept and value proposition), FEATURE_CATALOG the _what_ (the app's actual features, recorded as fact). Any purpose-specific material — a particular presentation, blog post, or pitch — is meant to be derived from these two as the need arises. The other documents here are such derivations, kept ready for general use rather than any single occasion — directly from those two, or by way of another derived document.

## Foundational sources

### [CONCEPT.md](./CONCEPT.md)

Articulates the product's core concept and value proposition — the source material behind any introduction. Lays out the premise ("no destination input" — the origin of the name Athenai), the UI reframing ("selecting, not searching"), the core values (from point-by-point lookup to a bird's-eye view, and how that view sparks chance encounters), and the two feature axes (finding stops / surveying departures). Written to convey the _why_ behind each point, not just the _what_.

### [FEATURE_CATALOG.md](./FEATURE_CATALOG.md)

An accurate, exhaustive inventory of what the app does, meant to be pulled from while authoring materials — it prioritizes factual correctness over polished wording or narrative flow. Classifies the WebApp's features by category (map & navigation / stop & transit events / timetable & trip / core system & data / interaction & UX) and describes each behavior. Pipeline processing is out of scope, except for Insight generation, which is documented as a product highlight.

## Derived documents

### [APP_OVERVIEW.md](./APP_OVERVIEW.md)

A single document that conveys the whole picture at a glance — a general-purpose overview kept on hand, not tailored to any one presentation. Covers what the app is, its concept and value, recommended ways to use it, device/environment support, a feature summary, screen/UI structure, supported data and coverage, and non-goals. As a rule it condenses and integrates the CONCEPT and FEATURE_CATALOG material, but this is a tendency rather than a constraint — it may also carry content of its own.

### [SLIDES.md](./SLIDES.md)

A Marp deck produced by condensing APP_OVERVIEW.md into slides, section by section. Unlike the documents above it was not anticipated when this README was written, and it is kept as a **worked example** rather than a maintained deliverable: something to start from when a deck is needed, not a deck to present as-is.

Being a condensation, it says less than APP_OVERVIEW.md by design — dropping qualifiers and detail to fit a slide is expected. Saying something *different* is not. Where the two disagree, APP_OVERVIEW.md is the one to trust.
