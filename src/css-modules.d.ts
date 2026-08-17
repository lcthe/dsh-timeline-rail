declare module '*.module.css' {
  /** Hashed class map compiled by the client bundle's CSS-module inline step. */
  const classes: Record<string, string>
  export default classes
}
