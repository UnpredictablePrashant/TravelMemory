import './App.css';
import { Outlet, createBrowserRouter, RouterProvider } from "react-router-dom";

import Header from './components/UIC/Header';
import Home from './components/pages/Home';
import AddExperience from './components/pages/AddExperience';
import ExperienceDetails from './components/pages/ExperienceDetails';
import NotFound from './components/pages/NotFound';
import StatusMessage from './components/UIC/StatusMessage';

// Header lives inside the router so its links navigate without a full page reload
function Layout() {
  return (
    <div className="tm-app">
      <Header></Header>
      <main className="tm-main">
        <Outlet />
      </main>
      <footer className="tm-footer">
        <div className="container">Travel Memory · Keep every journey</div>
      </footer>
    </div>
  );
}

function RouteError() {
  return (
    <div className="container py-5">
      <StatusMessage icon="⚠️" title="Something went wrong" message="An unexpected error occurred while showing this page." action={{ to: "/", label: "Go home" }} />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout></Layout>,
    errorElement: <RouteError></RouteError>,
    children: [
      {
        path: '/',
        element: <Home></Home>
      },
      {
        path: '/addexperience',
        element: <AddExperience></AddExperience>
      },
      {
        path: '/experiencedetails/:id',
        element: <ExperienceDetails></ExperienceDetails>
      },
      {
        path: '*',
        element: <NotFound></NotFound>
      }
    ]
  }
])

function App() {
  return <RouterProvider router={router}></RouterProvider>;
}

export default App;
