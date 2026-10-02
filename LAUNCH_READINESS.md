# The Concierge — Launch Readiness Review

This branch is a review/staging branch. It must not be treated as a production deployment and it does not modify the live Base44 application.

## Fixed in this branch

- Added a real Checkout route so Cart no longer navigates to a 404.
- Checkout now refuses to imply that a payment was processed before a production payment provider is connected.
- In-store checkout no longer creates completed Purchase records or deletes cart/wishlist items without an actual charge.
- In-store checkout filters cart display to products belonging to the selected store/vendor.
- Removed the hard-coded 8% in-store tax calculation; final tax is deferred to the store payment system.
- Product detail no longer remains on an infinite loading state when a product ID is missing.
- Product detail allows products without sizes and merges matching cart variants instead of creating duplicate lines.
- Wishlist no longer silently adds every product as size M; users are sent to Product Detail to choose valid options.
- Virtual Try-On uses category-aware suggested sizes rather than always using the user's top size.
- Virtual Try-On has an empty-catalog guard and no modulo-by-zero navigation.
- Dead Profile destinations are disabled instead of routing to missing pages; Customer Service routes to the existing Feedback page.
- Account deletion now removes more user-owned app records, including check-ins, payment metadata, reviews, AI feedback, shopping experiences, and friend connections.
- Account deletion copy now states that Base44 authentication and uploaded-file deletion may require separate platform-level handling.
- Added accessibility labels to several high-use icon controls touched by this work.

## Production blockers that still require platform/backend work

### 1. Row-level security (RLS)
The Base44 entity schemas reviewed during the audit did not include row-level security rules. Client-side filters such as user_id are not authorization. Before launch, RLS needs to be applied in Base44 for user-owned and business-sensitive entities, especially UserProfile, Friend, CartItem, WishlistItem, Purchase, StoreCheckin, PaymentMethod, ProductReview, AIFeedback, ShoppingExperience, and ClosetItem.

### 2. Real payments
The app has Stripe packages installed but no verified production payment flow. A real checkout needs server-side payment creation/confirmation, processor customer/payment-method tokens, webhook handling, receipts, refunds, failure states, and payment/order status persistence. Do not re-enable "Pay" behavior by merely creating Purchase entities on the client.

### 3. Order model and tax
Purchase currently represents individual product records rather than a complete order. A production implementation should persist order subtotal, quantity, tax, discounts, total, payment status, processor IDs, and fulfillment state. Tax should come from a configured tax service or store/payment system rather than a hard-coded percentage.

### 4. Concierge / Concierge Pro synchronization
The customer app and Concierge Pro currently use separate app/entity data. The linked app ID field by itself does not provide data synchronization. Cross-app customer, inventory, check-in, fitting-room, wishlist, and purchase flows need a supported shared backend/API design.

### 5. Account and file deletion
This branch deletes the app entities that the client can currently address. Full account deletion still needs a supported Base44 auth-user deletion path and deletion of uploaded body-scan/profile/review files from storage.

### 6. Personalization and AI claims
Home recommendations and some fit messaging still contain hard-coded/demo values. Body-scan accuracy claims should be validated and softened where validation is unavailable. Sensitive body images and measurements need clear privacy/storage disclosures.

### 7. Product and store data
The audited catalog had no dedicated try-on images, and audited vendor records had no configured locations. Those assets/data need to be populated for Virtual Try-On and automatic nearby-store detection to work as presented.

### 8. Remaining UX/engineering cleanup
Remaining work includes broader user-facing error messages, mobile closet edit/delete discoverability, additional accessibility cleanup, subscription cleanup in In-Store Mode, explicit store checkout/leave behavior, pagination/search scaling, dark-mode consistency, and existing lint/type-check cleanup outside the files changed here.

## Deployment rule

Review and test this branch first. Merge only approved changes. Applying equivalent changes to the live Base44 app should be a separate, explicit deployment step after RLS/payment architecture decisions are made.
