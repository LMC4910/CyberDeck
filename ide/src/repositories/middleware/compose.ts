// Compose middlewares into one (CD-125). Config decides the order; the array is
// applied left-to-right so the first entry is the outermost layer. Re-invoking
// next() is allowed (the retry middleware re-runs the downstream chain).
import type { Middleware, Next, RequestContext } from './types'

export function compose(middlewares: Middleware[]): Middleware {
  return (ctx: RequestContext, next: Next): Promise<unknown> => {
    const dispatch = (i: number, c: RequestContext): Promise<unknown> => {
      const mw = middlewares[i]
      if (!mw) return next(c)
      return mw(c, (nc) => dispatch(i + 1, nc))
    }
    return dispatch(0, ctx)
  }
}
