const form = document.querySelector("#chat-form");
const input = document.querySelector("#input");
const chat = document.querySelector("#chat");


const EXTRACT_API = "http://localhost:3000/extract";
const HANDOFF_API = "http://localhost:3000/handoff/generate-handoff";



form.addEventListener("submit", async (event) => {

    event.preventDefault();


    const text = input.value.trim();


    if (!text) return;



    addMessage(text, "user");


    input.value = "";



    const loading = addMessage(
        "Extracting context...",
        "ai"
    );



    try {


        // 1. Extract conversation context

        const extractResponse = await fetch(
            EXTRACT_API,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    text

                })

            }
        );



        const context = await extractResponse.json();



        loading.innerText =
            "Generating handoff...";



        // 2. Convert context into readable handoff


        const handoffResponse = await fetch(
            HANDOFF_API,
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },


                body: JSON.stringify(context)

            }
        );



        const handoff = await handoffResponse.text();



        loading.remove();



        addMessage(
            handoff,
            "ai"
        );


    } catch (error) {


        loading.remove();


        addMessage(
            error.message,
            "ai"
        );


        console.error(error);

    }

});





function addMessage(text, type) {


    const div = document.createElement("div");


    div.className = `message ${type}`;


    div.innerText = text;


    chat.appendChild(div);


    chat.scrollTop = chat.scrollHeight;


    return div;

}