| Model | t1+f1 cleaned P / R / F2 | protocol cleaned P / R / F2 | protocol raw word-exact F2 @0.5 | Known cases | Health | ms per 1k words |
|---|---|---|---|---|---|---|
| base-q8 | 0.947 / 0.514 / 0.566 | 0.855 / 0.707 / 0.732 | 0.770 | 26/33 | ok, 22 entity tokens unplaced | 428 |
| base-q8-ft | 0.950 / 0.543 / 0.594 | 0.843 / 0.729 / 0.750 | 0.829 | 27/33 | ok, 22 entity tokens unplaced | 475 |
| hebert | not on disk | | | | | |
| tiny-parse | 0.909 / 0.571 / 0.617 | 0.678 / 0.759 / 0.742 | 0.758 | 28/33 | ok, 22 entity tokens unplaced | 80 |
| tiny-parse-ft | 0.905 / 0.543 / 0.590 | 0.549 / 0.759 / 0.705 | 0.796 | 28/33 | ok, 22 entity tokens unplaced | 85 |
| iahlt-base | 0.950 / 0.543 / 0.594 | 1.000 / 0.624 / 0.675 | 0.797 | 28/33 | ok, 22 entity tokens unplaced | 473 |
| iahlt-base-ft | 0.900 / 0.514 / 0.563 | 0.957 / 0.662 / 0.705 | 0.795 | 28/33 | ok, 22 entity tokens unplaced | 467 |
| msperka-dicta | 0.944 / 0.486 / 0.538 | 0.943 / 0.752 / 0.784 | 0.907 | 29/33 | ok, 22 entity tokens unplaced | 437 |
| msperka-dicta-ft | 0.944 / 0.486 / 0.538 | 0.960 / 0.714 / 0.753 | 0.931 | 29/33 | ok, 22 entity tokens unplaced | 471 |
| aleph | 0.950 / 0.543 / 0.594 | 0.895 / 0.767 / 0.789 | 0.838 | 28/33 | ok, 29 entity tokens unplaced | 487 |
| joint-base | 0.947 / 0.514 / 0.566 | 0.874 / 0.729 / 0.754 | 0.831 | 29/33 | ok, 22 entity tokens unplaced | 515 |
| joint-base-ft | 0.950 / 0.543 / 0.594 | 0.990 / 0.744 / 0.783 | 0.883 | 29/33 | ok, 22 entity tokens unplaced | 506 |
| parse-base | 0.947 / 0.514 / 0.566 | 0.876 / 0.744 / 0.767 | 0.895 | 29/33 | ok, 22 entity tokens unplaced | 506 |
| parse-base-ft | 0.952 / 0.571 / 0.621 | 0.888 / 0.714 / 0.743 | 0.889 | 29/33 | ok, 22 entity tokens unplaced | 531 |
| golem | 1.000 / 0.514 / 0.570 | 0.945 / 0.519 / 0.570 | 0.379 | 21/33 | ok | 845 |
| large-q8 | 0.952 / 0.571 / 0.621 | 0.748 / 0.692 / 0.702 | 0.776 | 26/33 | ok, 22 entity tokens unplaced | 1607 |
| large-q8-ft | 1.000 / 0.571 / 0.625 | 0.764 / 0.707 / 0.718 | 0.799 | 28/33 | ok, 22 entity tokens unplaced | 1761 |
