/**
 * The page, built into a container element. A placeholder: it proves the
 * `@eriknaslund/skiss` package runs in a browser and that the deploy works,
 * and nothing more. The editor and the rendered diagram come later.
 *
 * Every element is created here rather than written into `index.html`, so a
 * test can mount the page into a detached element and type into it.
 */

import { VERSION } from '@eriknaslund/skiss';
import { preview } from './preview';
import { SAMPLE } from './sample';

/** What the diagnostics panel says when the compiler had nothing to say. */
const NO_DIAGNOSTICS = 'No diagnostics.';

export function mount(root: HTMLElement): void {
  root.replaceChildren();

  const title = document.createElement('h1');
  title.textContent = 'Skiss playground';

  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = `@eriknaslund/skiss ${VERSION}`;
  title.append(' ', version);

  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Write a sketch, see the diagram, share a link. Work in progress.';

  const header = document.createElement('header');
  header.append(title, tagline);

  const sketchLabel = document.createElement('label');
  sketchLabel.className = 'heading';
  sketchLabel.htmlFor = 'sketch';
  sketchLabel.textContent = 'Sketch';

  const sketch = document.createElement('textarea');
  sketch.id = 'sketch';
  sketch.spellcheck = false;
  sketch.autocapitalize = 'off';
  sketch.setAttribute('autocorrect', 'off');
  sketch.value = SAMPLE;

  const sketchPanel = document.createElement('section');
  sketchPanel.className = 'panel';
  sketchPanel.append(sketchLabel, sketch);

  const mermaidHeading = document.createElement('h2');
  mermaidHeading.className = 'heading';
  mermaidHeading.textContent = 'Mermaid';

  const mermaid = document.createElement('pre');
  mermaid.id = 'mermaid';

  const diagnosticsHeading = document.createElement('h2');
  diagnosticsHeading.className = 'heading';
  diagnosticsHeading.textContent = 'Diagnostics';

  const diagnostics = document.createElement('pre');
  diagnostics.id = 'diagnostics';

  const outputPanel = document.createElement('section');
  outputPanel.className = 'panel';
  outputPanel.append(mermaidHeading, mermaid, diagnosticsHeading, diagnostics);

  const main = document.createElement('main');
  main.append(sketchPanel, outputPanel);

  root.append(header, main);

  function update(): void {
    const shown = preview(sketch.value);
    mermaid.textContent = shown.mermaid;
    diagnostics.textContent =
      shown.diagnostics.length > 0 ? shown.diagnostics.join('\n') : NO_DIAGNOSTICS;
    diagnostics.classList.toggle('quiet', shown.diagnostics.length === 0);
  }

  sketch.addEventListener('input', update);
  update();
}
