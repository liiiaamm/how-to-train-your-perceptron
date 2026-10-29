# How to Train Your Perceptron

An interactive explainer for the simplest neural network there is. Move the bias $b$, the weights $w_1, w_2$ and the threshold $\tau$, and watch the decision boundary $b + w_1 x_1 + w_2 x_2 = \tau$ sweep across the plane until it separates the AND or OR truth table.

**[Open the live site →](https://liiiaamm.github.io/how-to-train-your-perceptron/)**

Made for the Numerical Methods course at Comillas ICAI (BSc in Mathematical Engineering and AI). Plain HTML, CSS and JavaScript, no build step.

## What's inside

| Page | Content |
|---|---|
| [`index.html`](index.html) | Landing page |
| [`teoria.html`](teoria.html) | The theory: gradients of a single-layer perceptron, AND/OR, why XOR is impossible for it, and how a two-layer network solves it |
| [`interactivo.html`](interactivo.html) | The interactive demo with live sliders and the decision boundary |
| [`pdf.html`](pdf.html) · [`Paper.pdf`](Paper.pdf) | The original written report |

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

## Authors

- Alejandro Alcázar
- Liam Esgueva González

## License

Free to use for academic purposes. If you reuse the interactive code, a link back is appreciated.
