import type { GatsbyConfig } from "gatsby";

const config: GatsbyConfig = {
  siteMetadata: {
    title: `Andrew Semchism`,
    siteUrl: `https://www.semchism.me`
  },
  // More easily incorporate content into your pages through automatic TypeScript type generation and better GraphQL IntelliSense.
  // If you use VSCode you can also use the GraphQL plugin
  // Learn more at: https://gatsby.dev/graphql-typegen
  graphqlTypegen: true,
  plugins: ["gatsby-plugin-netlify", "gatsby-plugin-image", "gatsby-plugin-sharp", "gatsby-transformer-sharp", {
    resolve: 'gatsby-source-filesystem',
    options: {
      "name": "images",
      "path": "./src/images/"
    },
    __key: "images"
  },
  {
    resolve: `gatsby-omni-font-loader`,
    options: {
      icon: 'src/images/logo.svg',
      enableListener: true,
      preconnect: [`https://fonts.googleapis.com`, `https://fonts.gstatic.com`],
      web: [
        {
          name: `Inter`,
          file: `https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap`,
        },
        {
          name: `Roboto Mono`,
          file: `https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@500&display=swap`
        }
      ],
    },
  }]
};

export default config;
