var solver = require('javascript-lp-solver'),
    model = {
        "optimize": "profit",
        "opType": "max",
        "constraints": {
            "paper": {"max": 20000},
            "labor": {"max": 110},
            "storage": {"max": 400}
        },
        "variables": {
            "hard cover book": {"paper": 250, "labor": 1.5, "profit": 12.50, "hard book": 1, "storage": 1},
            "soft cover book": {"paper": 250, "labor": 1, "profit": 11, "soft book": 1, "storage": 1}
        },
        "ints": {"hard book": 1, "soft book": 1}
    }

console.log(solver.Solve(model));
