Sudoku Solver
=============

This project was a fun experiment to see how fully most [sudoku puzzles](http://en.wikipedia.org/wiki/Sudoku) could be solved without guessing and checking. It was created and weighs heavily upon [jQuery](http://jquery.com/) and its selectors for simple aggregation of rows, columns, and cells (which are 3x3 grids of nodes, by my poor nomenclature).

Demo
----

You can find a demo at <http://dpatti.github.com/sudoku/>.  
A good resource for puzzles is [Web Sudoku](http://www.websudoku.com/).

Solving Strategies
------------------

First and foremost is the **common sense fill-in**. As you can see in the blank board state, each node has the numbers 1-9 labeled on it to indicate that it can accept any of those numbers. If you enter a number, you will notice the nodes that share a row, column, and cell with said node change their available numbers. When there is only one available number, it must logically be the solution for that node. This process is run after each iteration to help find easy targets.

There are then five solving strategies that I follow in sequential order to help complete the puzzle:

1. **Finalizations**: In this step, each row, column, and node is checked for each of the 9 numbers. If the number in question is not in the solution yet and can only fit into one of the 9 nodes, it is clearly the solution for that node.  Note that because this step actually sets a node's value, any time it is done, the solving strategy must be interrupted for a full board recalculation and restarted again.

2. **Cell to row/column cancelling**: Here we are checking each cell for each of the 9 numbers. If any given number is found to only possibly exist on multiple nodes that share a row or column, it can be implied that it cannot exist in any other node in the same row or column and is thus cancelled out from the possibilities.  

3. **Row/column to cell isolation**: As the reverse of the previous step, we are checking rows and columns for where each of the numbers could possibly exist.  If all occurences of any given number fall within the same cell, we can cancel that number out from all other nodes in that cell.

4. **Similar node inside trimming**: In this slightly more complicated step, we are looking in rows, columns, and cells for patterns in the remaining possibilities. If we find n nodes that share the same n possibilities, and if those possibilities do not exist elsewhere in the search, they must be limited to each of the n nodes. Therefore, the excess possibilities in each of those nodes can be eliminated.

5. **Similar node outside cancelling**: As a follow up to the previous strategy, in any row, column, or cell containing a set of similar nodes as described above, each of the nodes in the complement of the set can have the possibility removed of being any of the numbers contained in the set.

These five functions are executed on each pass until a solution is found or no advances have been made. At this point the puzzle is either solved or unsolvable without guessing. At least, as far as I can tell.
