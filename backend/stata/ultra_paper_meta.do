* =============================================================================
* Ultra Paper — Stata 16+ do-file for the "Data CSV" export (study, yi, vi, sei, year, group, mod)
* Usage:  do backend/stata/ultra_paper_meta.do "ultra-paper-analysis-data.csv"
* Tip: the R · Stata · Python page also generates a do-file with your raw 2x2 / mean-SD data embedded.
* =============================================================================
version 16
clear all
set more off
args csvfile
if "`csvfile'" == "" local csvfile "ultra-paper-analysis-data.csv"

import delimited using "`csvfile'", varnames(1) encoding("utf-8") clear
capture confirm variable sei
if _rc gen double sei = sqrt(vi)

* Random-effects REML; for Knapp–Hartung add: se(khartung)   (ad-hoc: se(khartung, truncated))
meta set yi sei, random(reml) studylabel(study)
meta summarize
meta forestplot
graph export "forest_plot_stata.png", width(2400) replace

meta funnelplot, contours(1 5 10)
graph export "funnel_plot_stata.png", width(2000) replace
meta bias, egger
meta bias, begg
meta trimfill, funnel

capture noisily meta summarize, subgroup(group)
capture noisily meta regress year
capture noisily estat bubbleplot
capture noisily meta regress mod
capture noisily meta summarize, leaveoneout
capture noisily meta summarize, cumulative(year)
* For ratio measures (yi = log RR/OR/HR) add the option eform to summarize/forestplot.
