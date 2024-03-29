$(function(){
    // Queueing system so that we don't get overloaded with duplicate node updates
    var queue = [];
    var queueTime = 10;
    var queueIter = function(){
        if(queue.length > 0) {
            if(queue.pop().recalc())
                setTimeout(function(){
                    queueIter();
                }, queueTime);
                else
                    queueIter();

        }
    };
    $.fn.queueRecalc = function(){
        $(this).each(function(){
            for (i in queue)
                // don't add to queue if it's already there
            if (queue[i] == $(this))
                return;
            queue.push($(this));
        });
        queueIter();
    };
    // Recalc checks every answered node in this row, column, and cell to see what to strike off
    $.fn.recalc = function(){
        // should only be a single node
        if ($(this).length > 1)
            return false;

        // no need to recalc if an answer is already locked in
        if ($(this).find(".ans").text())
            return false;

        //highlight this
        $(this).addClass("focus");
        var cur = this;
        setTimeout(function(){
            $(cur).removeClass("focus");
        }, queueTime);

        var x = $(this).attr("x"), 
        y = $(this).attr("y"), 
        cell = $(this).attr("cell");

        // restore all
        $(this).find(".grid td").removeClass("ticked");
        $(this).removeClass("alert");

        // check row, col, and cells
        var ticked = {};
        $("td[x="+x+"]").add("td[y="+y+"]").add("td[cell="+cell+"]").has(".ans:visible").find(".ans").each(function(){
            ticked[$(this).text()] = true;
        });

        for(var i in ticked){
            $(this).find(".grid td[mark="+i+"]").addClass("ticked");
        }

        // console.log(x,y,$(this).find(".grid td:not(.ticked)").length);
        var solns = $(this).find(".grid td:not(.ticked)");
        if(solns.length == 1 && !$(this).find(".ans").text()){
            if($("#fill").is(":checked") || solving){
                set($(this), solns.text());
            } else {
                $(this).addClass("alert");
            }
        }

        return true;
    };

    // Solving uses more logic based on what is or isn't ticked on unanswered nodes. There are 5 solving strategies that are applied each time
    var solving = false;
    var solveCtr = 0;
    var solveFns = [
        // solve 1: finalizations - finding only 1 remanining possbility of a number in a row/column/cell - NOTE: does a set(), so need an immediate queueRecalc and break from the main solving line
        function(nodeSet){
            // for each possible mark (1 through 9) check if there is ever just 1 left
            nodeSet = nodeSet.has(".ans:empty");
            for(var i=1;i<10;i++){
                var res = nodeSet.find("td[mark="+i+"]:not(.ticked)");
                if (res.length == 1)
                    return set(res.closest(".grid").parent(), i);
            }
        },

        // solve 2: cell to row/column canceling - checking where remaining items are in cells and if they line up, cancelling others in that row/column
        function(nodeSet, type){
            // make sure this is a cell check and not a row/col
            if (type == "cell") {
                // for each possible integer left
                for(var i=1;i<10;i++){
                    // get all the nodes with them
                    var res = nodeSet.has(".ans:empty").has("td[mark="+i+"]:not(.ticked)");
                    var x = res.eq(0).attr("x"), 
                    y = res.eq(0).attr("y");
                    res.addClass("skip"); // temporary marker
                    if (res.length == res.filter("[x="+x+"]").length){
                        // all in the same row
                        $("td[x="+x+"]:not(.skip)").find(".grid td[mark="+i+"]").addClass("ticked");
                    } else if (res.length == res.filter("[y="+y+"]").length){
                        // all in the same column
                        $("td[y="+y+"]:not(.skip)").find(".grid td[mark="+i+"]").addClass("ticked");									
                    }
                    res.removeClass("skip");
                }						
            }
        },

        // solve 3: row/column to cell isolations - when all possible nodes for a specific number are in the same cell, cancel others outside the row in that cell
        function(nodeSet, type){
            // make sure this is not a cell check
            if (type != "cell") {
                var ansrs = nodeSet.find(".ans").text();
                nodeSet = nodeSet.has(".ans:empty");
                // for each integer left
                for(var i=1;i<10;i++){
                    // check that this isn't an answer
                    if (ansrs.indexOf(i) == -1){
                        // get all of interest in our row
                        var res = nodeSet.has("td[mark="+i+"]:not(.ticked)");
                        var cell = res.eq(0).attr("cell");
                        res.addClass("skip");
                        if (res.length == res.filter("[cell="+cell+"]").length){
                            // all in the same cell
                            $("td[cell="+cell+"]:not(.skip)").find(".grid td[mark="+i+"]").addClass("ticked");
                        }
                        res.removeClass("skip");
                    }
                }
            }
        },

        // solve 4: node pairs trimming extras - n nodes with n similar possibilities unique to those nodes, clean off all other possibile numbers
        function(nodeSet){
            // give each node an identifier
            var iden = 0;
            nodeSet.each(function(){
                $(this).attr("tempID", iden++);
            });

            // gather pair information (map of node combinations to array of things they can take similarly)
            var pairs = {};
            for(var i=1;i<10;i++){
                var p = nodeSet.find(".grid td[mark="+i+"]:not(.ticked)").closest("td[cell]");
                var id = "";
                p.each(function(){
                    id += $(this).attr("tempID");
                });
                if (id in pairs)
                    pairs[id].push(i);
                else
                    pairs[id] = [i];
            }

            // check each one for size of key equalling size of value
            for(var p in pairs){
                if (p.length == pairs[p].length) {
                    // we have a closed circuit
                    var circuit = $();
                    for (var id in p)
                        circuit = circuit.add(nodeSet.filter("[tempID="+p[id]+"]"));

                    // get marks
                    var allMarks = circuit.find(".grid td:not(.ticked)");
                    for (var i=0;i<pairs[p].length;i++)
                        allMarks = allMarks.filter("[mark!="+pairs[p][i]+"]");

                    allMarks.addClass("ticked");
                }
            }

            // strip the temp ids
            nodeSet.attr("tempID", "");
        },

        // solve 5: tuple cancelling - n cells with n number possibilities that they all have as their only options - a follow up to the previous solve function.
        function(nodeSet){
            // check row, col, and cells for tuples
            var res = nodeSet.has(".ans:empty");
            var tuples = {};
            res.each(function(){
                var tup = $(this).find(".grid td:not(.ticked)").text();
                tuples[tup] = (tuples[tup] || 0) + 1
            });
            // check if any are sized appropriately
            for (var str in tuples) {
                if (str.length == tuples[str]) {
                    // iterate over others in row
                    res.each(function(){
                        if ($(this).find(".grid td:not(.ticked)").text() != str)
                            // iterate over characters (digits) and tick
                        for (var digit in str)
                            $(this).find(".grid td[mark="+str[digit]+"]").addClass("ticked");
                    });
                }
            }
        },
    ];
    var solveIter = function(){
        solving = true;
        // start by recording unanswered nodes and marked grid (for simple comparison later)
        var ansCt = $(".ans:empty").length,
        gridCt = $(".grid td.ticked").length;

        // select functions first so we check the whole board with a function before moving to the next
        for(var fn=0;fn<solveFns.length;fn++){
            for(;solveCtr<9;solveCtr++){
                if (solveFns[fn]($("td[x="+solveCtr+"]"), "x")) break;
                if (solveFns[fn]($("td[y="+solveCtr+"]"), "y")) break;
                if (solveFns[fn]($("td[cell="+solveCtr+"]"), "cell")) break;
            }
            if (solveCtr < 9)
                break;
            solveCtr = solveCtr % 9;
        }

        console.log("Ended at solveCtr="+solveCtr);

        // solve iterations are done, now process the queue
        queueIter();
        inSolve = false;

        // check if the board is clear
        if ($(".ans:empty").length == 0){
            solving = false;
            return; // we win
        }

        // check to see if we made progress. if not ...well, fuck.
        if ($(".ans:empty").length == ansCt && $(".grid td.ticked").length == gridCt){
            // we did not win
            solving = false;
            return;
        } else {
            // progress was made, let's take a breath and try again
            var reSolve = function(){
                if (queue.length == 0)
                    solveIter();
                else
                    setTimeout(reSolve, queueTime);
            }
            setTimeout(reSolve, queueTime);
        }
    };

    var set = function(node, n){
        var x = node.attr("x");
        var y = node.attr("y");
        var cell = node.attr("cell");
        n = parseInt(n) || 0;

        if (n < 1 || n > 9) {
            node.find(".grid").show();
            node.find(".ans").hide().text("");
        } else {
            node.find(".grid").hide();
            node.find(".ans").show().text(n);
            node.removeClass("alert");
        }
        $("td[x="+x+"]").add("td[y="+y+"]").add("td[cell="+cell+"]").queueRecalc();

        return true;
    }


    // init
    for(var y=0;y<9;y++){
        //create row
        var tr = $("#sudoku").append("<tr>").find("tr:last");
        for(var x=0;x<9;x++){
            //create cell
            var td = tr.append("<td>").find("td:last");
            td.attr("x", x);
            td.attr("y", y);
            td.attr("cell", Math.floor(x/3)+Math.floor(y/3)*3);
            if (y%3 == 0)
                td.css({ borderTop: "5px solid black" });
            if (x%3 == 0)
                td.css({ borderLeft: "5px solid black" });

            // input
            var inp = td.append("<input class='inp' type='text'>").find("input").hide().attr("maxlength", 1).keydown(function(e){
                if(e.keyCode == 13){
                    //enter
                    if ($(this).parent().find(".ans").text() != $(this).val())
                        set($(this).parent(), $(this).val());
                    $(this).val("").hide();
                } else if(e.keyCode == 27) {
                    //esc
                    $(this).val("").hide();
                }
            }).blur(function(){
                if($(this).is(":visible"))
                    if ($(this).parent().find(".ans").text() != $(this).val())
                        set($(this).parent(), $(this).val());
                    $(this).val("").hide();
            });
            // answer
            var ans = td.append("<div class='ans'>").find(".ans").hide();
            // grid
            var grid = td.append("<table class='grid'>").find("table");
            for (j=0;j<3;j++){
                var gridr = grid.append("<tr>").find("tr:last");
                for (i=0;i<3;i++){
                    var val = i+j*3+1
                    gridr.append("<td>").find("td:last").text(val).attr("mark", val);
                }
            }

            td.click(function(){
                if($(this).find(".inp:visible").length > 0)
                    return;

                $(".inp:visible").val("").hide();
                $(this).find(".inp").show().focus();

                //if we have an answer, use that
                var ans = $(this).find(".ans").text();
                if (ans) {
                    $(this).find(".inp").val(ans);
                } else {
                    var solns = $(this).find(".grid td:not(.ticked)");
                    if (solns.length == 1)
                        $(this).find(".inp").val(solns.text());
                }
                $(this).find(".inp").select();
            });

            td.hover(function(){
                $(this).addClass("hover");
            }, function(){
                $(this).removeClass("hover");
            });
        }
    }
    $("#reset").click(function(){
        $(".ticked").removeClass("ticked");
        $(".alert").removeClass("alert");
        $(".ans").text("").hide();
        $(".inp").val("").hide();
        $(".grid").show();
    });	
    $("#fill").change(function(){
        $(".alert").queueRecalc();
    });
    $("#solve").click(function(){
        if(queue.length == 0){
            solveIter();
        }
        $("#fill").attr("disabled", $(this).is(":checked")?"disabled":"");
    });
});

