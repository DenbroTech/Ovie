-- Ovie: which part of each photo the wall screen shows (chosen in Photos → "Fit to wall").
-- Add-only. Fractions of the picture (0–1): left, top, width, height. All empty = the middle of the photo.
alter table ovie.photos
  add column crop_x real check (crop_x >= 0 and crop_x < 1),
  add column crop_y real check (crop_y >= 0 and crop_y < 1),
  add column crop_w real check (crop_w > 0 and crop_w <= 1),
  add column crop_h real check (crop_h > 0 and crop_h <= 1),
  add constraint photos_crop_all_or_none check (
    (crop_x is null and crop_y is null and crop_w is null and crop_h is null)
    or (crop_x is not null and crop_y is not null and crop_w is not null and crop_h is not null
        and crop_x + crop_w <= 1.0001 and crop_y + crop_h <= 1.0001));
