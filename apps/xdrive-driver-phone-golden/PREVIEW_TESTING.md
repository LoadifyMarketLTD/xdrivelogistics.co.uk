# XDrive Driver Preview Testing

This file documents the physical-device validation path for the isolated preview build.

- GOLDEN installed package remains `co.uk.xdrivelogistics.driver` and must not be replaced during preview validation.
- Preview package is `co.uk.xdrivelogistics.driver.preview`.
- Preview display name is `XDrive Driver Preview`.
- Preview must be installed side-by-side with GOLDEN.
- Physical-device gate order: launch -> login/session -> loads -> quote -> booking -> status lifecycle -> pickup evidence -> delivery POD -> offline replay -> GPS/tracking -> alerts/messaging.
- No merge to `main`, production deployment, or production database migration until the physical-device gates pass.
