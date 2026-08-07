# Build the draft.  `make` -> main.pdf   `make clean` -> remove aux files
main.pdf: main.tex refs.bib
	latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex

clean:
	latexmk -C
	rm -f *.bbl *.blg

.PHONY: clean
