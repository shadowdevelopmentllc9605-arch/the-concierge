# The Concierge — Phase One style-preference image sources

Eight fashion categories are displayed on `src/components/onboarding/StylePreferences.jsx`.

The first four original photo assets are retained from previously established, Base44-generated public imagery and are mapped to **Business, Casual, Evening, Outdoor**. They are not copied or repackaged in this change.

The other four images are independently sourced, **free-to-use photos under the Unsplash License**:

| Style | Photo | Creator | Source |
| --- | --- | --- | --- |
| Formal | A man in a black tuxedo and waistcoat | Benjamin R. | https://unsplash.com/photos/SZoTel1Y4qc |
| Active | Woman in athletic clothing | Anes Hamzic | https://unsplash.com/photos/AFhg4Ve6vxg |
| Nightlife | Woman dancing in a retro outfit under red light | Laszlo Barta | https://unsplash.com/photos/w9X85IPyNKE |
| Trendy | Man wearing green hoodie, jeans, skatewear | Mikolaj Felinski | https://unsplash.com/photos/1Wj3SLoQGcU |

License: https://unsplash.com/license — free use for commercial and noncommercial applications, with credit appreciated.

**Implementation:** External Unsplash `images.unsplash.com` URLs are used directly, optimized to 720px wide. No binary assets were committed. Because URLs are remote, a browser/device smoke test is needed before certifying all eight images render, and future production hardening should host reviewed/owned assets with stable attribution. Image selection does not touch Supabase, customer photos, payment, or onboarding progress.
