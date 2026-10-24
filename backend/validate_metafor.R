#!/usr/bin/env Rscript
# Ultra Paper — validation & publication graphics with metafor
#
# Usage:
#   Rscript backend/validate_metafor.R data.csv [method] [test] [level]
#       data.csv = "R/Stata/Python → Data CSV" export (columns study, yi, vi; optional year, group, mod)
#       method   = REML | DL | PM | ML | HE | SJ | FE      (default REML)
#       test     = z | knha | knha-adhoc                   (default z)
#   Rscript backend/validate_metafor.R --json in.json out.json      (used by the FastAPI backend)
#
# Outputs (CSV mode): console summary + forest_plot.png, funnel_plot.png, metafor_results.json

suppressPackageStartupMessages(library(metafor))
args <- commandArgs(trailingOnly = TRUE)
map_test <- function(t) switch(t, "knha" = "knha", "knha-adhoc" = "adhoc", "z")

summarise <- function(res) {
  out <- list(k = res$k, method = res$method, test = res$test, mu = as.numeric(res$b), se = res$se,
              ci = c(res$ci.lb, res$ci.ub), p = res$pval, tau2 = res$tau2, Q = res$QE, Qp = res$QEp,
              I2 = res$I2, H2 = res$H2, engine = paste("R", getRversion(), "· metafor", packageVersion("metafor")))
  if (res$method != "FE" && res$k > 1) {
    ci <- tryCatch(confint(res)$random, error = function(e) NULL)
    if (!is.null(ci)) out$tau2_ci <- unname(ci["tau^2", c("ci.lb", "ci.ub")])
  }
  out
}

if (length(args) >= 3 && args[1] == "--json") {
  suppressPackageStartupMessages(library(jsonlite))
  req <- fromJSON(args[2])
  st <- req$studies
  res <- rma(yi = st$yi, vi = st$vi, method = req$method, test = map_test(req$test), level = req$level)
  write(toJSON(summarise(res), auto_unbox = TRUE, digits = NA), args[3])
  quit(status = 0)
}

if (length(args) < 1) stop("Usage: Rscript validate_metafor.R data.csv [method] [test] [level]")
dat <- read.csv(args[1], check.names = FALSE, fileEncoding = "UTF-8-BOM")
names(dat) <- tolower(names(dat))
if (!all(c("yi", "vi") %in% names(dat))) stop("CSV needs columns yi and vi")
method <- ifelse(length(args) >= 2, args[2], "REML")
test   <- map_test(ifelse(length(args) >= 3, args[3], "z"))
level  <- ifelse(length(args) >= 4, as.numeric(args[4]), 95)
slab   <- if ("study" %in% names(dat)) dat$study else paste("Study", seq_len(nrow(dat)))

res <- rma(yi, vi, data = dat, slab = slab, method = method, test = test, level = level)
print(res)
if (method != "FE") print(confint(res))
print(regtest(res)); print(ranktest(res)); print(trimfill(res))
print(leave1out(res))

png("forest_plot.png", width = 2600, height = 500 + 110 * nrow(dat), res = 300)
forest(res, addpred = TRUE, shade = TRUE, header = TRUE); dev.off()
png("funnel_plot.png", width = 2000, height = 1700, res = 300)
funnel(res, level = c(90, 95, 99), shade = c("white", "gray80", "gray65"), refline = 0, legend = TRUE); dev.off()

if (requireNamespace("jsonlite", quietly = TRUE)) {
  writeLines(jsonlite::toJSON(summarise(res), auto_unbox = TRUE, digits = NA, pretty = TRUE), "metafor_results.json")
}
cat("\nSaved: forest_plot.png, funnel_plot.png, metafor_results.json\n")
