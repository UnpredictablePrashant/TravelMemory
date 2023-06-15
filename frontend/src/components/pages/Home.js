import React from 'react'
import Card from '../UIC/Card'
import FeaturedCard from '../UIC/FeaturedCard'

export default function Home() {
  return (
    <div style={{ margin: "2%"}}>
        <FeaturedCard></FeaturedCard>
        <Card></Card>
        <Card></Card>
        <Card></Card>
    </div>
  )
}
