# Architecture & Legal Decision Record: Content Licensing, Copyright & Trademark Assets

- **Status**: Proposed / Pending Owner Selection
- **Deciders**: Engineering Lead, Product Owner / Repository Maintainer
- **Date**: 2026-09-18
- **Finding Reference**: MED-03

---

## 1. Context & Problem Statement

AlgoJeet Pro bundles two categories of third-party assets in `public/`:
1. **2,746 Scraped Problem Statements**: Located in `public/data/descriptions/*.json`, containing verbatim problem descriptions, example test cases, explanations, constraints, and LeetCode slugs.
2. **654 Corporate Brand Logos**: Located in `public/logos/*.png`, reproducing trademarked corporate identities (Google, Meta, Apple, Amazon, Microsoft, Uber, Netflix, Stripe, etc.).
3. **Repository Licensing**: The root `LICENSE` file applies the MIT license universally across all repository files without distinguishing software source code from third-party proprietary content.

### Legal & Commercial Reality
- A README disclaimer asserting "All rights belong to their respective owners" provides zero legal immunity or defense against copyright infringement under the Digital Millennium Copyright Act (DMCA) or trademark infringement under the Lanham Act.
- Granting an MIT license over scraped text gives downstream users a fraudulent sub-license to redistribute copyrighted prose.
- Distributing corporate brand logos in software repositories creates trademark confusion and direct trademark infringement risk.

---

## 2. Options Analyzed

### Option A: Metadata-Only + Deep Linking + Styled Text Logos (Recommended)
- **Problem Statements**: Delete all 2,746 `public/data/descriptions/*.json` files. Retain non-copyrightable factual metadata in `problems.json`: ID, problem title, difficulty level, patterns, topics, and company interview frequencies. Display problem metadata, examples, and deep-link directly to the official LeetCode problem URL.
- **Logos**: Remove the 654 `.png` image files. Replace company logos with clean, high-performance CSS styled text badges / avatars (e.g. initial monogram with distinct design system typography). Factual nominative use of company names is protected under nominative fair use doctrine.
- **Licensing**: Explicitly scope `LICENSE` to source code only. Declare all metadata under ODbL or fair factual compilation terms.
- **Tradeoffs**:
  - *Pros*: Eliminates 95% of legal liability; reduces repository asset footprint by over 20 MB; zero trademark infringement exposure; fastest path to safe public hosting.
  - *Cons*: Users must click the deep-link or view short summaries for full problem narrative if not viewing curated core sets.

### Option B: Original Curated Problem Statements (Clean-Room Synthesis)
- **Problem Statements**: Write clean-room, original algorithmic problem narratives and test suites for a curated subset of 150–300 core patterns (the 75 essential interview questions).
- **Logos**: Same as Option A (styled text badges).
- **Tradeoffs**:
  - *Pros*: 100% original copyright ownership; total freedom to monetize, publish, or distribute as a commercial SaaS product.
  - *Cons*: High content creation effort (several weeks of authoring).

### Option C: Retain Scraped Content Under Private / Non-Commercial Status
- **Problem Statements**: Retain files for personal offline research only.
- **Tradeoffs**:
  - *Pros*: Zero migration code work.
  - *Cons*: Strictly inadmissible for public GitHub repositories, hosted web deployments, or commercial offerings. High risk of immediate DMCA repository takedown.

---

## 3. Recommended Action Plan

1. **Owner Action**: Select **Option A** for production deployment.
2. **License Separation**: Update root `LICENSE` to explicitly exclude third-party problem descriptions and company names.
3. **Asset Migration**:
   - Replace logo rendering components with accessible styled text monograms (`<CompanyAvatar name={company.name} />`).
   - Remove `public/logos/` from Git tracking.
   - Retain problem metadata and provide official problem deep links in `ProblemWorkspace.tsx`.
4. **History Scrubbing**: If repository was previously pushed publicly, execute `git-filter-repo` or BFG Repo-Cleaner before public release.
