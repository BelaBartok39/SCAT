# Two drafts of the same paper share refs.bib:
#   main.pdf   IEEE journal style  (IEEEtran, two-column, numeric cites)
#   paper.pdf  JOSS-like style     (jossalike.sty, sidebar, author-year)
#
#   make          -> both
#   make paper    -> the JOSS-like draft only
#   make main     -> the IEEE draft only
#   make clean    -> remove build artifacts

LATEXMK = latexmk -pdf -interaction=nonstopmode -halt-on-error

all: main.pdf paper.pdf

main: main.pdf
paper: paper.pdf

main.pdf: main.tex refs.bib
	$(LATEXMK) main.tex

paper.pdf: paper.tex jossalike.sty refs.bib
	$(LATEXMK) paper.tex

clean:
	$(LATEXMK) -C
	rm -f *.bbl *.blg

.PHONY: all main paper clean
