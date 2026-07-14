// Compose middlewares into one (CD-125). Config decides the order; the array is
// applied left-to-right so the first entry is the outermost layer.
import type { Middleware, Next, RequestContext } from './types'

export function compose(middlewares: Middleware[]): Middleware {
  return (ctx: RequestContext, next: Next): Promise<unknown> => {
    let lastIndex = -1
    const dispatch = (i: number, c: RequestContext): Promise<unknown> => {
      if (i <= lastIndex) return Promise.reject(new Error('next() called multiple times'))
      lastIndex = i
      const mw = middlewares[i]
      if (!mw) return next(c)
      return mw(c, (nc) => dispatch(i + 1, nc))
    }
    return dispatch(0, ctx)
  }
}
