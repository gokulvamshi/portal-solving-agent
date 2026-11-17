import ast, builtins, json, sys

def check_output(source):
    # Deliberately limited to self-contained, deterministic introductory Python.
    # No imports, filesystem, networking, reflection, input, classes or JS bridge.
    allowed = 'abs all any bin bool chr dict divmod enumerate filter float format hex int isinstance len list map max min oct ord pow range reversed round slice sorted str sum tuple zip print Exception ValueError TypeError IndexError KeyError ZeroDivisionError NameError StopIteration'.split()
    methods = set('append extend insert pop remove clear copy count index reverse sort join split rsplit splitlines strip lstrip rstrip replace upper lower capitalize title swapcase startswith endswith find rfind isalpha isdigit isalnum islower isupper isspace keys values items get update setdefault format'.split())
    try:
        tree = ast.parse(source)
        compile(tree, '<practice>', 'exec')
    except SyntaxError as e:
        return json.dumps({'supported': True, 'output': '', 'exception': type(e).__name__})
    forbidden = (ast.Import, ast.ImportFrom, ast.ClassDef, ast.AsyncFunctionDef, ast.Await, ast.With, ast.AsyncWith, ast.Global, ast.Nonlocal, ast.Set, ast.SetComp)
    for n in ast.walk(tree):
        if isinstance(n, forbidden):
            return json.dumps({'supported': False, 'reason': 'Unsupported Python feature'})
        if isinstance(n, ast.Name) and (n.id.startswith('_') or (n.id in dir(builtins) and n.id not in allowed)):
            return json.dumps({'supported': False, 'reason': 'Unsupported builtin'})
        if isinstance(n, ast.Attribute) and n.attr not in methods:
            return json.dumps({'supported': False, 'reason': 'Unsupported attribute'})
        if isinstance(n, ast.Constant) and isinstance(n.value, (str, bytes)) and (len(n.value) > 10000 or '__' in str(n.value)):
            return json.dumps({'supported': False, 'reason': 'Large literal'})
    parts, size, steps = [], 0, 0
    def capture(*args, sep=' ', end='\n', file=None, flush=False):
        nonlocal size
        if file is not None: raise ValueError('Unsupported print file')
        value = sep.join(str(x) for x in args) + end
        size += len(value)
        if size > 8000: raise RuntimeError('Output limit')
        parts.append(value)
    def trace(frame, event, arg):
        nonlocal steps
        steps += 1
        if steps > 20000: raise RuntimeError('Step limit')
        return trace
    env = {'__builtins__': {k: getattr(builtins, k) for k in allowed}}
    env['__builtins__']['print'] = capture
    exception = None
    try:
        sys.settrace(trace)
        exec(compile(tree, '<practice>', 'exec'), env, env)
    except RuntimeError:
        return json.dumps({'supported': False, 'reason': 'Execution limit'})
    except BaseException as e:
        exception = type(e).__name__
    finally:
        sys.settrace(None)
    return json.dumps({'supported': True, 'output': ''.join(parts), 'exception': exception})
