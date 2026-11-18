# Optional artwork

The simulator draws a side-view aircraft and supply crate directly on Canvas by default, so no image files are required. Use the **Plane image** and **Package image** controls in the dashboard to load local PNG, JPG, WEBP, or SVG sprites (up to 8 MB each); **Reset art** restores the Canvas drawings.

Files placed in this directory are not loaded automatically. To use committed sprites by default, wire their paths into the image initialization in `js/app.js`; the math modules do not depend on artwork.