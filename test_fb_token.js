const token = 'EAAYA0g05EhoBSY0mxZARe3hje6CjMqnoez2SJl4N7R4FZBMZAU0TpXG3D7kxBCO8k826wGd84vkrHd809UZCyyj5J4LSo8mgoRMXvqYOR1joESZAX4aZCxrYVsPZAEjVxJsZCpnA6Ouq3fcX17ZALIoZBs8EbySfKwTqaQS17AOsT4kNOLF694QXdbF2BNzQdQOAB6EAZDZD';
async function test() {
    const res = await fetch(`https://graph.facebook.com/v20.0/192831060756593?fields=access_token&access_token=${token}`);
    const data = await res.json();
    console.log("Main Page Token:", data.access_token ? "SUCCESS" : data);
    
    const res2 = await fetch(`https://graph.facebook.com/v20.0/1204516039414311?fields=access_token&access_token=${token}`);
    const data2 = await res2.json();
    console.log("Football Page Token:", data2.access_token ? "SUCCESS" : data2);
}
test();
