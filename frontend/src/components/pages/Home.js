import React, { useEffect, useState } from "react";
import Card from "../UIC/Card";
import FeaturedCard from "../UIC/FeaturedCard";
import axios from "axios";
import { baseUrl } from "../../url";

export default function Home() {
  const [data, setData] = useState();
  useEffect(() => {
    axios.get(`${baseUrl}/trip/`).then((res) => setData(res.data));
  }, []);
  if (data) {
    return (
      <div style={{ margin: "2%" }}>
        {data.map((e) => {
          if (e.featured) {
            return (
              <FeaturedCard
                title={e.tripName}
                tripType={e.tripType}
                description={e.shortDescription}
                id={e._id}
              ></FeaturedCard>
            );
          } else {
            return null;
          }
        })}
        {data.map((e) => {
          if (!e.featured) {
            return (
              <Card
                title={e.tripName}
                tripType={e.tripType}
                description={e.shortDescription}
                id={e._id}
              ></Card>
            );
          } else {
            return null;
          }
        })}
      </div>
    );
  } else {
    return <>Loading...</>;
  }
}
