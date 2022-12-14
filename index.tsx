import { GetStaticProps, InferGetStaticPropsType } from "next";
import { createSwaggerSpec } from "next-swagger-doc";
import packageJson from "../package.json" assert { type: "json" };
import SwaggerUI, { SwaggerUIProps } from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

function ApiDoc({ spec }: InferGetStaticPropsType<typeof getStaticProps>) {
  return <SwaggerUI spec={spec} />;
}

export const getStaticProps: GetStaticProps = async () => {
  const spec: Record<string, any> = createSwaggerSpec({
    definition: {
      openapi: "3.0.0",
      info: {
        title: packageJson.name,
        description: packageJson?.description,
        version: packageJson.version,
      },
    },
  } as SwaggerUIProps);

  return {
    props: {
      spec,
    },
  };
};

export default ApiDoc;
